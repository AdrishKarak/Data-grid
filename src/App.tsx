"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  type FC,
  type KeyboardEvent,
  type MouseEvent,
  type DragEvent,
  type ChangeEvent,
} from "react";

type Align = "left" | "right";
type SortDir = "asc" | "desc";

interface ColumnDef {
  key: string;
  label: string;
  width: number;
  pinned: boolean;
  sortable: boolean;
  editable: boolean;
  align: Align;
  format?: (value: unknown) => string;
}

interface Row {
  id: number;
  name: string;
  department: string;
  role: string;
  salary: number;
  startDate: string;
  location: string;
  status: Status;
  performance: number;
  email: string;
  [key: string]: unknown;
}

type Status = "Active" | "On Leave" | "Remote" | "Hybrid" | "Probation";

interface SortEntry {
  key: string;
  dir: SortDir;
}

interface EditCell {
  rowIdx: number;
  key: string;
}

interface ValidationResult {
  valid: boolean;
  error: string | null;
}

interface UndoEntry {
  rowId: number;
  key: string;
  oldValue: unknown;
}

interface FocusPos {
  row: number;
  col: number;
}

interface VisibleScrollResult {
  cols: ColumnDef[];
  startIdx: number;
  offsetLeft: number;
}

const COLUMN_DEFS: ColumnDef[] = [
  { key: "id", label: "ID", width: 70, pinned: true, sortable: true, editable: false, align: "right" },
  { key: "name", label: "Name", width: 180, pinned: true, sortable: true, editable: true, align: "left" },
  { key: "department", label: "Department", width: 150, pinned: false, sortable: true, editable: true, align: "left" },
  { key: "role", label: "Role", width: 160, pinned: false, sortable: true, editable: true, align: "left" },
  {
    key: "salary",
    label: "Salary",
    width: 120,
    pinned: false,
    sortable: true,
    editable: true,
    align: "right",
    format: (v: unknown): string => `$${Number(v).toLocaleString()}`,
  },
  { key: "startDate", label: "Start Date", width: 130, pinned: false, sortable: true, editable: true, align: "left" },
  { key: "location", label: "Location", width: 140, pinned: false, sortable: true, editable: true, align: "left" },
  { key: "status", label: "Status", width: 110, pinned: false, sortable: true, editable: true, align: "left" },
  { key: "performance", label: "Perf. Score", width: 110, pinned: false, sortable: true, editable: true, align: "right" },
  { key: "email", label: "Email", width: 220, pinned: false, sortable: true, editable: true, align: "left" },
];

const DEPARTMENTS: string[] = ["Engineering", "Marketing", "Sales", "HR", "Finance", "Design", "Product", "Legal", "Operations", "Support"];
const ROLES: string[] = ["Engineer", "Manager", "Director", "Analyst", "Designer", "Specialist", "Consultant", "Lead", "Associate", "VP"];
const LOCATIONS: string[] = ["New York", "San Francisco", "London", "Toronto", "Berlin", "Tokyo", "Singapore", "Austin", "Chicago", "Seattle"];
const STATUSES: Status[] = ["Active", "On Leave", "Remote", "Hybrid", "Probation"];

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 38;
const OVERSCAN = 12;
const TOTAL_ROWS = 50000;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateData(count: number = TOTAL_ROWS): Row[] {
  const firstNames: string[] = ["James", "Maria", "David", "Sarah", "Michael", "Emily", "Robert", "Jessica", "William", "Jennifer", "Daniel", "Lisa", "Matthew", "Amanda", "Anthony", "Ashley", "Mark", "Nicole", "Steven", "Stephanie"];
  const lastNames: string[] = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"];

  const data: Row[] = [];
  for (let i = 0; i < count; i++) {
    const yr: number = 2015 + Math.floor(Math.random() * 9);
    const mo: string = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
    const dy: string = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
    data.push({
      id: i + 1,
      name: `${pick(firstNames)} ${pick(lastNames)}`,
      department: pick(DEPARTMENTS),
      role: pick(ROLES),
      salary: 40000 + Math.floor(Math.random() * 160000),
      startDate: `${yr}-${mo}-${dy}`,
      location: pick(LOCATIONS),
      status: pick(STATUSES),
      performance: +((3.0 + Math.random() * 7).toFixed(1)),
      email: `${pick(firstNames).toLowerCase()}.${pick(lastNames).toLowerCase()}${i}@company.com`,
    });
  }
  return data;
}
const INITIAL_DATA: Row[] = generateData();

function validateField(key: string, value: string): Promise<ValidationResult> {
  return new Promise<ValidationResult>((resolve) => {
    setTimeout(() => {
      const trimmed: string = value.trim();

      if (trimmed === "") {
        resolve({ valid: false, error: `${key} cannot be empty` });
        return;
      }
      if (key === "salary" && (isNaN(Number(trimmed)) || Number(trimmed) < 0)) {
        resolve({ valid: false, error: "Salary must be a positive number" });
        return;
      }
      if (key === "performance") {
        const n: number = Number(trimmed);
        if (isNaN(n) || n < 0 || n > 10) {
          resolve({ valid: false, error: "Score must be 0–10" });
          return;
        }
      }
      if (key === "email" && !trimmed.includes("@")) {
        resolve({ valid: false, error: "Invalid email format" });
        return;
      }
      resolve({ valid: true, error: null });
    }, 200 + Math.random() * 300);
  });
}

function multiSort(data: Row[], sorts: SortEntry[]): Row[] {
  if (sorts.length === 0) return data;

  return [...data].sort((a: Row, b: Row): number => {
    for (const { key, dir } of sorts) {
      const av = a[key] as string | number;
      const bv = b[key] as string | number;
      let cmp = 0;
      if (av < bv) cmp = -1;
      else if (av > bv) cmp = 1;
      if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    }
    return 0;
  });
}

const STATUS_STYLES: Record<Status, { bg: string; }> = {
  "Active": { bg: "#166534" },
  "On Leave": { bg: "#854d0e" },
  "Remote": { bg: "#1e40af" },
  "Hybrid": { bg: "#6b21a8" },
  "Probation": { bg: "#991b1b" },
};

interface HeaderCellProps {
  col: ColumnDef;
  isPinned: boolean;
  leftOffset: number;
  sortInfo: { dir: SortDir; priority: number } | null;
  multiSortActive: boolean;
  isDragTarget: boolean;
  onSort: (key: string) => void;
  onResizeStart: (e: MouseEvent<HTMLDivElement>, key: string) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, key: string) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>, key: string) => void;
  onDrop: (e: DragEvent<HTMLDivElement>, key: string) => void;
  onDragEnd: () => void;
}

const HeaderCell: FC<HeaderCellProps> = ({
  col, isPinned, leftOffset, sortInfo, multiSortActive,
  isDragTarget, onSort, onResizeStart, onDragStart, onDragOver, onDrop, onDragEnd,
}) => {
  const [hovered, setHovered] = useState<boolean>(false);

  const ariaSort: "ascending" | "descending" | "none" = sortInfo
    ? (sortInfo.dir === "asc" ? "ascending" : "descending")
    : "none";

  return (
    <div
      role="columnheader"
      aria-sort={ariaSort}
      tabIndex={-1}
      draggable={!col.pinned}
      onDragStart={(e: DragEvent<HTMLDivElement>) => onDragStart(e, col.key)}
      onDragOver={(e: DragEvent<HTMLDivElement>) => onDragOver(e, col.key)}
      onDrop={(e: DragEvent<HTMLDivElement>) => onDrop(e, col.key)}
      onDragEnd={onDragEnd}
      onClick={() => col.sortable && onSort(col.key)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute",
        left: leftOffset,
        top: 0,
        width: col.width,
        height: HEADER_HEIGHT,
        zIndex: isPinned ? 20 : 10,
        display: "flex",
        alignItems: "center",
        justifyContent: col.align === "right" ? "flex-end" : "flex-start",
        paddingLeft: col.align === "right" ? 0 : 10,
        paddingRight: col.align === "right" ? 10 : 0,
        gap: 6,
        cursor: col.sortable ? "pointer" : "default",
        userSelect: "none",
        background: hovered ? "#2a2640" : "#1e1b2e",
        borderBottom: "1px solid #2e2b3f",
        borderRight: "1px solid #2e2b3f",
        boxSizing: "border-box",
        fontWeight: 600,
        fontSize: 12,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "#a8a4c0",
        opacity: isDragTarget ? 0.5 : 1,
        outline: "none",
        transition: "background 0.15s, opacity 0.15s",
      }}
    >
      {col.sortable && (
        <span style={{ fontSize: 11, color: sortInfo ? "#6366f1" : "#3a3750", minWidth: 18, textAlign: "center" }}>
          {sortInfo
            ? <>{sortInfo.dir === "asc" ? "↑" : "↓"}{multiSortActive && <sup style={{ fontSize: 8 }}>{sortInfo.priority}</sup>}</>
            : "⇅"
          }
        </span>
      )}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col.label}</span>


      <ResizeHandle onMouseDown={(e: MouseEvent<HTMLDivElement>) => onResizeStart(e, col.key)} />
    </div>
  );
};

interface ResizeHandleProps {
  onMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
}

const ResizeHandle: FC<ResizeHandleProps> = ({ onMouseDown }) => {
  const [active, setActive] = useState<boolean>(false);

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      style={{
        position: "absolute",
        right: 0, top: 0, bottom: 0,
        width: 5,
        cursor: "col-resize",
        zIndex: 30,
        background: active ? "#6366f1" : "transparent",
        transition: "background 0.15s",
      }}
    />
  );
};

interface GridCellProps {
  row: Row;
  rowIdx: number;
  col: ColumnDef;
  isPinned: boolean;
  leftOffset: number;
  isFocused: boolean;
  isEditing: boolean;
  editValue: string;
  editError: string | null;
  editValidating: boolean;
  onFocus: (rowIdx: number, colIdx: number) => void;
  globalColIdx: number;
  onDoubleClick: (rowIdx: number, key: string) => void;
  onEditChange: (value: string) => void;
  onEditBlur: () => void;
  startRowIdx: number;
  editInputRef: React.RefObject<HTMLInputElement | null>;
}

const GridCell: FC<GridCellProps> = ({
  row, rowIdx, col, isPinned, leftOffset,
  isFocused, isEditing, editValue, editError, editValidating,
  onFocus, globalColIdx, onDoubleClick, onEditChange, onEditBlur,
  startRowIdx, editInputRef,
}) => {
  const val: unknown = row[col.key];
  const displayVal: string = col.format ? col.format(val) : String(val);

  return (
    <div
      role="gridcell"
      aria-label={`${col.label}: ${displayVal}`}
      tabIndex={isFocused ? 0 : -1}
      onFocus={() => onFocus(rowIdx, globalColIdx)}
      onDoubleClick={() => onDoubleClick(rowIdx, col.key)}
      style={{
        position: "absolute",
        left: leftOffset,
        top: (rowIdx - startRowIdx) * ROW_HEIGHT,
        width: col.width,
        height: ROW_HEIGHT,
        zIndex: isPinned ? 5 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: col.align === "right" ? "flex-end" : "flex-start",
        paddingLeft: col.align === "right" ? 0 : 10,
        paddingRight: col.align === "right" ? 10 : 0,
        fontSize: 13,
        color: "#d1cde6",
        background: isPinned
          ? (rowIdx % 2 === 0 ? "#1a1728" : "#1c1930")
          : (rowIdx % 2 === 0 ? "#16141f" : "#181622"),
        borderBottom: "1px solid #2a2740",
        borderRight: "1px solid #2a2740",
        boxSizing: "border-box",
        outline: isFocused ? "2px solid #6366f1" : "none",
        outlineOffset: "-2px",
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        cursor: col.editable ? "pointer" : "default",
        boxShadow: isPinned ? "2px 0 4px rgba(0,0,0,0.2)" : "none",
      }}
    >
      {isEditing ? (
        <EditInput
          editValue={editValue}
          editError={editError}
          editValidating={editValidating}
          rowIdx={rowIdx}
          colKey={col.key}
          onChange={onEditChange}
          onBlur={onEditBlur}
          inputRef={editInputRef}
        />
      ) : (
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {col.key === "status" ? (
            <StatusBadge status={val as Status} />
          ) : (
            displayVal
          )}
        </span>
      )}
    </div>
  );
};

interface EditInputProps {
  editValue: string;
  editError: string | null;
  editValidating: boolean;
  rowIdx: number;
  colKey: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

const EditInput: FC<EditInputProps> = ({
  editValue, editError, editValidating, rowIdx, colKey, onChange, onBlur, inputRef,
}) => (
  <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
    <input
      ref={inputRef}
      value={editValue}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      onBlur={onBlur}
      aria-invalid={!!editError}
      aria-describedby={editError ? `err-${rowIdx}-${colKey}` : undefined}
      style={{
        width: "100%", height: "100%",
        background: "#2a2640", color: "#fff",
        border: `1px solid ${editError ? "#ef4444" : "#6366f1"}`,
        borderRadius: 3, padding: "0 8px", fontSize: 13, outline: "none",
        boxSizing: "border-box",
      }}
    />
    {editValidating && (
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "absolute", bottom: "-22px", left: 0,
          background: "#4f46e5", color: "#fff", fontSize: 10,
          padding: "2px 6px", borderRadius: 3, zIndex: 100, whiteSpace: "nowrap",
        }}
      >
        Validating…
      </div>
    )}
    {editError && !editValidating && (
      <div
        id={`err-${rowIdx}-${colKey}`}
        role="alert"
        style={{
          position: "absolute", bottom: "-22px", left: 0, right: 0,
          background: "#ef4444", color: "#fff", fontSize: 10,
          padding: "2px 6px", borderRadius: 3, whiteSpace: "nowrap", zIndex: 100,
        }}
      >
        {editError}
      </div>
    )}
  </div>
);

interface StatusBadgeProps {
  status: Status;
}

const StatusBadge: FC<StatusBadgeProps> = ({ status }) => (
  <span style={{
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
    background: STATUS_STYLES[status].bg,
    color: "#e2e8f0",
  }}>
    {status}
  </span>
);

interface ColumnMenuProps {
  columns: ColumnDef[];
  hiddenColumns: Set<string>;
  onToggle: (key: string) => void;
  onClose: () => void;
}

const ColumnMenu: FC<ColumnMenuProps> = ({ columns, hiddenColumns, onToggle, onClose }) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);


  useEffect(() => {
    const handler = () => onClose();
    const timer = setTimeout(() => window.addEventListener("click", handler), 0);
    return () => { clearTimeout(timer); window.removeEventListener("click", handler); };
  }, [onClose]);

  return (
    <div
      onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      style={{
        position: "absolute", top: 48, right: 16, zIndex: 200,
        background: "#1e1b2e", border: "1px solid #3a3750", borderRadius: 8,
        padding: 8, minWidth: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ fontSize: 11, color: "#6b6880", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 8px 8px" }}>
        Toggle Columns
      </div>
      {columns.map((c: ColumnDef) => (
        <label
          key={c.key}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "4px 8px", cursor: "pointer", borderRadius: 4,
            fontSize: 13, color: "#d1cde6",
            background: hoveredKey === c.key ? "#2a2640" : "transparent",
            transition: "background 0.1s",
          }}
          onMouseEnter={() => setHoveredKey(c.key)}
          onMouseLeave={() => setHoveredKey(null)}
        >
          <input
            type="checkbox"
            checked={!hiddenColumns.has(c.key)}
            onChange={() => onToggle(c.key)}
            style={{ accentColor: "#6366f1" }}
          />
          {c.label}
          {c.pinned && <span style={{ fontSize: 10, color: "#6366f1", marginLeft: "auto" }}>📌 pinned</span>}
        </label>
      ))}
    </div>
  );
};

const DataGrid: FC = () => {

  const [data, setData] = useState<Row[]>(INITIAL_DATA);
  const [columns, setColumns] = useState<ColumnDef[]>(COLUMN_DEFS);
  const [sorts, setSorts] = useState<SortEntry[]>([]);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [scrollLeft, setScrollLeft] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [containerHeight, setContainerHeight] = useState<number>(600);

  const [editCell, setEditCell] = useState<EditCell | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editValidating, setEditValidating] = useState<boolean>(false);

  const [focusCell, setFocusCell] = useState<FocusPos>({ row: 0, col: 0 });
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>(COLUMN_DEFS.map((c: ColumnDef) => c.key));

  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [showColumnMenu, setShowColumnMenu] = useState<boolean>(false);


  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);


  const sortedData: Row[] = useMemo(() => multiSort(data, sorts), [data, sorts]);


  const visibleCols: ColumnDef[] = useMemo(() => {
    return columnOrder
      .filter((k: string) => !hiddenColumns.has(k))
      .map((k: string) => columns.find((c: ColumnDef) => c.key === k))
      .filter((c): c is ColumnDef => c !== undefined);
  }, [columns, columnOrder, hiddenColumns]);

  const pinnedCols: ColumnDef[] = useMemo(
    () => visibleCols.filter((c: ColumnDef) => c.pinned),
    [visibleCols]
  );
  const scrollableCols: ColumnDef[] = useMemo(
    () => visibleCols.filter((c: ColumnDef) => !c.pinned),
    [visibleCols]
  );

  const pinnedWidth: number = useMemo(
    () => pinnedCols.reduce((sum: number, c: ColumnDef) => sum + c.width, 0),
    [pinnedCols]
  );
  const scrollableWidth: number = useMemo(
    () => scrollableCols.reduce((sum: number, c: ColumnDef) => sum + c.width, 0),
    [scrollableCols]
  );


  const totalRows: number = sortedData.length;
  const visibleRowCount: number = Math.ceil(containerHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const startRowIdx: number = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endRowIdx: number = Math.min(totalRows, startRowIdx + visibleRowCount);
  const visibleRows: Row[] = sortedData.slice(startRowIdx, endRowIdx);


  const scrollableVisArea: number = containerWidth - pinnedWidth;
  const visibleScrollCols: VisibleScrollResult = useMemo((): VisibleScrollResult => {
    let accum = 0;
    let startIdx = 0;

    for (let i = 0; i < scrollableCols.length; i++) {
      if (accum + scrollableCols[i].width > scrollLeft) {
        startIdx = i;
        break;
      }
      accum += scrollableCols[i].width;
      startIdx = i;
    }

    let endIdx: number = startIdx;
    let w = 0;
    for (let i = startIdx; i < scrollableCols.length; i++) {
      w += scrollableCols[i].width;
      endIdx = i + 1;
      if (w > scrollableVisArea + scrollLeft - accum) break;
    }

    return { cols: scrollableCols.slice(startIdx, endIdx), startIdx, offsetLeft: accum };
  }, [scrollableCols, scrollLeft, scrollableVisArea]);


  const pinnedOffsets: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    let offset = 0;
    for (const c of pinnedCols) {
      map[c.key] = offset;
      offset += c.width;
    }
    return map;
  }, [pinnedCols]);

  const scrollOffsets: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    let offset = pinnedWidth;
    for (const c of scrollableCols) {
      map[c.key] = offset;
      offset += c.width;
    }
    return map;
  }, [scrollableCols, pinnedWidth]);


  useEffect(() => {
    const el: HTMLDivElement | null = containerRef.current;
    if (!el) return;

    const obs = new ResizeObserver((entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height - HEADER_HEIGHT);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);


  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>): void => {
    const target: HTMLDivElement = e.currentTarget;
    setScrollTop(target.scrollTop);
    setScrollLeft(target.scrollLeft);
  }, []);


  const handleSort = useCallback((key: string): void => {
    setSorts((prev: SortEntry[]) => {
      const idx: number = prev.findIndex((s: SortEntry) => s.key === key);
      if (idx === -1) return [...prev, { key, dir: "asc" }];
      if (prev[idx].dir === "asc") return prev.map((s: SortEntry, i: number) => (i === idx ? { ...s, dir: "desc" } : s));
      return prev.filter((_: SortEntry, i: number) => i !== idx);
    });
  }, []);

  const getSortInfo = useCallback((key: string): { dir: SortDir; priority: number } | null => {
    const idx: number = sorts.findIndex((s: SortEntry) => s.key === key);
    if (idx === -1) return null;
    return { dir: sorts[idx].dir, priority: idx + 1 };
  }, [sorts]);


  const handleResizeStart = useCallback((e: MouseEvent<HTMLDivElement>, key: string): void => {
    e.preventDefault();
    e.stopPropagation();

    const startX: number = e.clientX;
    const col: ColumnDef | undefined = columns.find((c: ColumnDef) => c.key === key);
    if (!col) return;
    const startW: number = col.width;

    const onMove = (ev: globalThis.MouseEvent): void => {
      const diff: number = ev.clientX - startX;
      const newW: number = Math.max(60, startW + diff);
      setColumns((prev: ColumnDef[]) =>
        prev.map((c: ColumnDef) => (c.key === key ? { ...c, width: newW } : c))
      );
    };

    const onUp = (): void => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [columns]);


  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, key: string): void => {
    setDragSource(key);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, key: string): void => {
    e.preventDefault();
    setDragTarget(key);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, key: string): void => {
    e.preventDefault();
    if (!dragSource || dragSource === key) {
      setDragSource(null);
      setDragTarget(null);
      return;
    }
    setColumnOrder((prev: string[]) => {
      const arr: string[] = [...prev];
      const fromIdx: number = arr.indexOf(dragSource);
      const toIdx: number = arr.indexOf(key);
      arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, dragSource);
      return arr;
    });
    setDragSource(null);
    setDragTarget(null);
  }, [dragSource]);

  const handleDragEnd = useCallback((): void => {
    setDragSource(null);
    setDragTarget(null);
  }, []);


  const startEdit = useCallback((rowIdx: number, key: string): void => {
    const col: ColumnDef | undefined = columns.find((c: ColumnDef) => c.key === key);
    if (!col || !col.editable) return;
    setEditCell({ rowIdx, key });
    setEditValue(String(sortedData[rowIdx][key]));
    setEditError(null);
    setEditValidating(false);
  }, [columns, sortedData]);

  useEffect(() => {
    if (editCell && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editCell]);

  const commitEdit = useCallback(async (): Promise<void> => {
    if (!editCell) return;
    const { rowIdx, key } = editCell;

    setEditValidating(true);
    const result: ValidationResult = await validateField(key, editValue);
    setEditValidating(false);

    if (!result.valid) {
      setEditError(result.error);
      return;
    }

    const oldValue: unknown = sortedData[rowIdx][key];
    const rowId: number = sortedData[rowIdx].id;


    setUndoStack((prev: UndoEntry[]) => [...prev.slice(-50), { rowId, key, oldValue }]);


    setData((prev: Row[]) =>
      prev.map((row: Row) => {
        if (row.id !== rowId) return row;
        const newVal: unknown =
          key === "salary" || key === "performance" ? Number(editValue) : editValue;
        return { ...row, [key]: newVal };
      })
    );

    setEditCell(null);
    setEditError(null);
  }, [editCell, editValue, sortedData]);

  const cancelEdit = useCallback((): void => {
    setEditCell(null);
    setEditError(null);
  }, []);


  const handleUndo = useCallback((): void => {
    if (!undoStack.length) return;
    const { rowId, key, oldValue } = undoStack[undoStack.length - 1];

    setData((prev: Row[]) =>
      prev.map((row: Row) => (row.id === rowId ? { ...row, [key]: oldValue } : row))
    );
    setUndoStack((prev: UndoEntry[]) => prev.slice(0, -1));
  }, [undoStack]);


  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>): void => {

    if (editCell) {
      if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
      else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
      return;
    }

    const { row, col } = focusCell;
    let nr: number = row;
    let nc: number = col;
    const maxCol: number = visibleCols.length - 1;
    const maxRow: number = sortedData.length - 1;

    switch (e.key) {
      case "ArrowDown": e.preventDefault(); nr = Math.min(maxRow, row + 1); break;
      case "ArrowUp": e.preventDefault(); nr = Math.max(0, row - 1); break;
      case "ArrowRight": e.preventDefault(); nc = Math.min(maxCol, col + 1); break;
      case "ArrowLeft": e.preventDefault(); nc = Math.max(0, col - 1); break;
      case "Enter":
      case "F2":
        e.preventDefault();
        startEdit(row, visibleCols[col]?.key ?? "");
        return;
      case "Home": e.preventDefault(); nc = 0; break;
      case "End": e.preventDefault(); nc = maxCol; break;
      case "PageDown": e.preventDefault(); nr = Math.min(maxRow, row + Math.floor(containerHeight / ROW_HEIGHT)); break;
      case "PageUp": e.preventDefault(); nr = Math.max(0, row - Math.floor(containerHeight / ROW_HEIGHT)); break;
      case "z":
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); handleUndo(); }
        return;
      default:
        return;
    }

    setFocusCell({ row: nr, col: nc });


    if (scrollRef.current) {
      const targetTop: number = nr * ROW_HEIGHT;
      if (targetTop < scrollRef.current.scrollTop) {
        scrollRef.current.scrollTop = targetTop;
      } else if (targetTop + ROW_HEIGHT > scrollRef.current.scrollTop + containerHeight) {
        scrollRef.current.scrollTop = targetTop + ROW_HEIGHT - containerHeight;
      }
    }
  }, [editCell, focusCell, visibleCols, sortedData, containerHeight, commitEdit, cancelEdit, startEdit, handleUndo]);


  const toggleColumn = useCallback((key: string): void => {
    setHiddenColumns((prev: Set<string>) => {
      const next: Set<string> = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);




  return (
    <div
      onKeyDown={handleKeyDown}
      style={{
        width: "100%", height: "100vh",
        background: "#12111a",
        display: "flex", flexDirection: "column",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#d1cde6",
      }}
    >

      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 16px", background: "#1e1b2e",
        borderBottom: "1px solid #2e2b3f", flexShrink: 0, position: "relative",
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
          <span style={{ color: "#6366f1" }}>⊞</span> DataGrid
        </div>
        <div style={{ fontSize: 12, color: "#6b6880", marginLeft: 4 }}>
          {totalRows.toLocaleString()} rows · {visibleCols.length} columns
        </div>
        <div style={{ flex: 1 }} />


        {sorts.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#2a2640", borderRadius: 6, padding: "4px 10px",
            fontSize: 12, color: "#a8a4c0",
          }}>
            <span style={{ color: "#6366f1", fontWeight: 600 }}>Sort:</span>
            {sorts.map((s: SortEntry, i: number) => (
              <span key={s.key} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                {i > 0 && <span style={{ color: "#5a5770" }}>·</span>}
                <span style={{ color: "#d1cde6" }}>{columns.find((c: ColumnDef) => c.key === s.key)?.label}</span>
                <span style={{ color: "#6366f1" }}>{s.dir === "asc" ? "↑" : "↓"}</span>
              </span>
            ))}
            <button
              onClick={() => setSorts([])}
              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}
            >×</button>
          </div>
        )}

        <button
          onClick={() => setShowColumnMenu((prev: boolean) => !prev)}
          style={{
            background: "#2a2640", border: "1px solid #3a3750", color: "#a8a4c0",
            borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4,
          }}
        >⚙ Columns</button>

        <button
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          aria-label="Undo last edit"
          style={{
            background: "#2a2640", border: "1px solid #3a3750",
            color: undoStack.length ? "#a8a4c0" : "#3a3750",
            borderRadius: 6, padding: "5px 10px", fontSize: 12,
            cursor: undoStack.length ? "pointer" : "default",
          }}
        >↩ Undo</button>


        {showColumnMenu && (
          <ColumnMenu
            columns={columns}
            hiddenColumns={hiddenColumns}
            onToggle={toggleColumn}
            onClose={() => setShowColumnMenu(false)}
          />
        )}
      </div>


      <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 0 }}>


        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: HEADER_HEIGHT, zIndex: 15, display: "flex", overflow: "hidden",
        }}>

          <div style={{ position: "relative", width: pinnedWidth, flexShrink: 0, height: HEADER_HEIGHT }}>
            {pinnedCols.map((c: ColumnDef) => (
              <HeaderCell
                key={c.key}
                col={c}
                isPinned={true}
                leftOffset={pinnedOffsets[c.key]}
                sortInfo={getSortInfo(c.key)}
                multiSortActive={sorts.length > 1}
                isDragTarget={dragTarget === c.key && dragSource !== null && dragSource !== c.key}
                onSort={handleSort}
                onResizeStart={handleResizeStart}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>

          <div style={{ flex: 1, overflow: "hidden", position: "relative", height: HEADER_HEIGHT }}>
            {visibleScrollCols.cols.map((c: ColumnDef) => (
              <HeaderCell
                key={c.key}
                col={c}
                isPinned={false}
                leftOffset={scrollOffsets[c.key] - pinnedWidth - scrollLeft}
                sortInfo={getSortInfo(c.key)}
                multiSortActive={sorts.length > 1}
                isDragTarget={dragTarget === c.key && dragSource !== null && dragSource !== c.key}
                onSort={handleSort}
                onResizeStart={handleResizeStart}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        </div>


        <div
          ref={scrollRef}
          onScroll={handleScroll}
          role="grid"
          aria-label="Employee Data Grid"
          aria-rowcount={totalRows}
          aria-colcount={visibleCols.length}
          tabIndex={0}
          style={{
            position: "absolute", top: HEADER_HEIGHT, left: 0, right: 0, bottom: 0,
            overflowX: "auto", overflowY: "auto",
          }}
        >

          <div style={{ position: "sticky", left: 0, zIndex: 10, display: "inline-block", width: pinnedWidth, verticalAlign: "top" }}>
            <div style={{ position: "relative", width: pinnedWidth, height: totalRows * ROW_HEIGHT }}>
              {visibleRows.map((row: Row, i: number) => {
                const rowIdx: number = startRowIdx + i;
                return (
                  <div
                    key={row.id}
                    role="row"
                    aria-rowindex={rowIdx + 1}
                    style={{ position: "absolute", top: rowIdx * ROW_HEIGHT, left: 0, width: pinnedWidth, height: ROW_HEIGHT }}
                  >
                    {pinnedCols.map((c: ColumnDef) => (
                      <GridCell
                        key={c.key}
                        row={row}
                        rowIdx={rowIdx}
                        col={c}
                        isPinned={true}
                        leftOffset={pinnedOffsets[c.key]}
                        isFocused={focusCell.row === rowIdx && focusCell.col === visibleCols.findIndex((vc: ColumnDef) => vc.key === c.key)}
                        isEditing={editCell?.rowIdx === rowIdx && editCell?.key === c.key}
                        editValue={editValue}
                        editError={editError}
                        editValidating={editValidating}
                        onFocus={(r: number, ci: number) => setFocusCell({ row: r, col: ci })}
                        globalColIdx={visibleCols.findIndex((vc: ColumnDef) => vc.key === c.key)}
                        onDoubleClick={startEdit}
                        onEditChange={setEditValue}
                        onEditBlur={commitEdit}
                        startRowIdx={startRowIdx}
                        editInputRef={editInputRef}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>


          <div style={{ display: "inline-block", width: scrollableWidth, verticalAlign: "top", position: "relative" }}>
            <div style={{ position: "relative", width: scrollableWidth, height: totalRows * ROW_HEIGHT }}>
              {visibleRows.map((row: Row, i: number) => {
                const rowIdx: number = startRowIdx + i;
                return (
                  <div
                    key={row.id}
                    role="row"
                    aria-rowindex={rowIdx + 1}
                    style={{ position: "absolute", top: rowIdx * ROW_HEIGHT, left: 0, width: scrollableWidth, height: ROW_HEIGHT }}
                  >
                    {scrollableCols.map((c: ColumnDef) => (
                      <GridCell
                        key={c.key}
                        row={row}
                        rowIdx={rowIdx}
                        col={c}
                        isPinned={false}
                        leftOffset={scrollOffsets[c.key] - pinnedWidth}
                        isFocused={focusCell.row === rowIdx && focusCell.col === visibleCols.findIndex((vc: ColumnDef) => vc.key === c.key)}
                        isEditing={editCell?.rowIdx === rowIdx && editCell?.key === c.key}
                        editValue={editValue}
                        editError={editError}
                        editValidating={editValidating}
                        onFocus={(r: number, ci: number) => setFocusCell({ row: r, col: ci })}
                        globalColIdx={visibleCols.findIndex((vc: ColumnDef) => vc.key === c.key)}
                        onDoubleClick={startEdit}
                        onEditChange={setEditValue}
                        onEditBlur={commitEdit}
                        startRowIdx={startRowIdx}
                        editInputRef={editInputRef}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>


      <div style={{
        height: 26, background: "#1e1b2e", borderTop: "1px solid #2e2b3f",
        display: "flex", alignItems: "center", gap: 16, paddingLeft: 16,
        fontSize: 11, color: "#5a5770", flexShrink: 0,
      }}>
        <span>Focused: Row {focusCell.row + 1}, Col {focusCell.col + 1}</span>
        <span>|</span>
        <span>Undo stack: {undoStack.length}</span>
        <span>|</span>
        <span>↑↓←→ Navigate · Enter/F2 Edit · Esc Cancel · Ctrl+Z Undo · Drag headers to reorder</span>
      </div>
    </div>
  );
};

export default DataGrid;