"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ChevronDown, Search, X, AlertTriangle } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string | React.ReactNode;
  width?: string;
  render?: (row: T) => React.ReactNode;
  filterable?: boolean; // Enable filter for this column
  filterType?: "text" | "select"; // Type of filter
  filterOptions?: { label: string; value: any }[]; // Options for select filter
}

export interface ColumnFilter {
  key: string;
  value: any;
}

export interface PaginationConfig {
  enabled: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pagination?: PaginationConfig;
  totalItems?: number;
  currentPage?: number;
  filters?: ColumnFilter[]; // Current filter values
  onFilterChange?: (filters: ColumnFilter[]) => void; // Callback when filters change
}

/**
 * TruncatedText component - shows tooltip if text is truncated
 * Tooltip automatically positions above or below based on available space
 */
function TruncatedText({ children }: { children: React.ReactNode }) {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showAbove, setShowAbove] = useState(false);
  const [tooltipLeft, setTooltipLeft] = useState(0);
  const [tooltipAnchor, setTooltipAnchor] = useState(0); // top or bottom of anchor in viewport
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = textRef.current;
    if (element) {
      const isTextOverflowing =
        element.scrollWidth > element.clientWidth ||
        element.scrollHeight > element.clientHeight;
      setIsOverflowing(isTextOverflowing);
    }
  }, [children]);

  // Convert children to string for tooltip
  const textContent =
    typeof children === "string"
      ? children
      : typeof children === "number"
        ? String(children)
        : React.isValidElement(children) &&
            children.props &&
            // @ts-expect-error - children.props.children is string
            typeof children.props.children === "string"
            // @ts-expect-error - children.props.children is string
          ? children.props.children
          : "";

  function handleMouseEnter() {
    if (!isOverflowing) return;

    const element = textRef.current;
    if (element) {
      const rect = element.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const above = spaceBelow < 150 && spaceAbove > spaceBelow;

      setShowAbove(above);
      // Store viewport coordinates so the fixed tooltip lands in the right place
      setTooltipAnchor(above ? rect.top - 4 : rect.bottom + 4);
      setTooltipLeft(rect.left);
    }

    setShowTooltip(true);
  }

  return (
    <div className="relative flex-1">
      <div
        ref={textRef}
        className="justify-start text-text-primary text-sm font-normal font-['Inter'] leading-5 line-clamp-1"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {children}
      </div>

      {/* Tooltip — uses fixed positioning so it escapes table overflow/stacking context */}
      {showTooltip && isOverflowing && textContent && (
        <div
          style={{
            position: 'fixed',
            left: tooltipLeft,
            ...(showAbove
              ? { bottom: window.innerHeight - tooltipAnchor }
              : { top: tooltipAnchor }),
            zIndex: 99999,
          }}
          className="px-3 py-2 bg-slate-900 text-white text-xs rounded-md shadow-lg max-w-sm wrap-break-word whitespace-normal"
        >
          {textContent}
          <div
            className={`absolute left-4 w-2 h-2 bg-slate-900 transform rotate-45 ${
              showAbove ? '-bottom-1' : '-top-1'
            }`}
          />
        </div>
      )}
    </div>
  );
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  pagination = { enabled: false },
  totalItems,
  currentPage = 1,
  filters = [],
  onFilterChange,
}: DataTableProps<T>) {
  const [internalPage, setInternalPage] = useState(currentPage);
  const [pageSize, setPageSize] = useState(pagination.pageSize || 10);
  const [showPageSizeDropdown, setShowPageSizeDropdown] = useState(false);
  const pageSizeButtonRef = useRef<HTMLButtonElement>(null);
  const [pageSizeDropdownPosition, setPageSizeDropdownPosition] = useState({
    top: 0,
    left: 0,
  });

  // Sync with controlled props when the parent updates them
  useEffect(() => {
    setInternalPage(currentPage);
  }, [currentPage]);
  useEffect(() => {
    if (pagination.pageSize && pagination.pageSize !== pageSize) {
      setPageSize(pagination.pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.pageSize]);
  const [localFilterValues, setLocalFilterValues] = useState<
    Record<string, string>
  >(filters.reduce((acc, filter) => ({ ...acc, [filter.key]: filter.value }), {}));
  const [appliedFilterValues, setAppliedFilterValues] = useState<
    Record<string, string>
  >(filters.reduce((acc, filter) => ({ ...acc, [filter.key]: filter.value }), {}));
  const [expandedFilters, setExpandedFilters] = useState<
    Record<string, boolean>
  >({});

  const pageSizeOptions = pagination.pageSizeOptions || [10, 25, 50, 100];
  const total = totalItems || data.length;
  const totalPages = Math.ceil(total / pageSize);
  const startItem = (internalPage - 1) * pageSize + 1;
  const endItem = Math.min(internalPage * pageSize, total);

  useEffect(() => {
    if (!showPageSizeDropdown) return;

    const closeDropdown = () => setShowPageSizeDropdown(false);
    window.addEventListener("resize", closeDropdown);
    window.addEventListener("scroll", closeDropdown, true);

    return () => {
      window.removeEventListener("resize", closeDropdown);
      window.removeEventListener("scroll", closeDropdown, true);
    };
  }, [showPageSizeDropdown]);

  function handlePageChange(newPage: number) {
    if (newPage >= 1 && newPage <= totalPages) {
      setInternalPage(newPage);
      pagination.onPageChange?.(newPage);
    }
  }

  function handlePageSizeChange(newPageSize: number) {
    setPageSize(newPageSize);
    setInternalPage(1);
    setShowPageSizeDropdown(false);
    pagination.onPageSizeChange?.(newPageSize);
  }

  function togglePageSizeDropdown() {
    if (showPageSizeDropdown) {
      setShowPageSizeDropdown(false);
      return;
    }

    const triggerRect = pageSizeButtonRef.current?.getBoundingClientRect();
    if (triggerRect) {
      const estimatedHeight = pageSizeOptions.length * 36;
      const opensUpward =
        triggerRect.bottom + 4 + estimatedHeight > window.innerHeight;

      setPageSizeDropdownPosition({
        left: triggerRect.right,
        top: opensUpward
          ? Math.max(8, triggerRect.top - estimatedHeight - 4)
          : triggerRect.bottom + 4,
      });
    }

    setShowPageSizeDropdown(true);
  }

  function handleLocalFilterChange(columnKey: string, value: string) {
    setLocalFilterValues((prev) => ({
      ...prev,
      [columnKey]: value,
    }));
  }

  function getLocalFilterValue(columnKey: string) {
    return localFilterValues[columnKey] || "";
  }

  function clearAllFilters() {
    setLocalFilterValues({});
    setAppliedFilterValues({});
    setExpandedFilters({});
    if (onFilterChange) {
      onFilterChange([]);
    }
  }

  function handleApplyFilter(columnKey: string, overrideValue?: string) {
    const val = overrideValue !== undefined ? overrideValue : (localFilterValues[columnKey] || "");

    if (overrideValue !== undefined) {
      setLocalFilterValues((prev) => ({ ...prev, [columnKey]: overrideValue }));
    }

    const newApplied = { ...appliedFilterValues };
    if (val) {
      newApplied[columnKey] = val;
    } else {
      delete newApplied[columnKey];
    }

    setAppliedFilterValues(newApplied);

    if (onFilterChange) {
      const newFilters: ColumnFilter[] = Object.entries(newApplied)
        .filter(([, v]) => v !== "" && v !== null && v !== undefined)
        .map(([key, value]) => ({ key, value }));
      onFilterChange(newFilters);
    }
  }

  function handleClearColumnFilter(columnKey: string) {
    const newLocal = { ...localFilterValues };
    delete newLocal[columnKey];
    setLocalFilterValues(newLocal);

    const newApplied = { ...appliedFilterValues };
    delete newApplied[columnKey];
    setAppliedFilterValues(newApplied);

    if (onFilterChange) {
      const newFilters: ColumnFilter[] = Object.entries(newApplied)
        .filter(([, v]) => v !== "" && v !== null && v !== undefined)
        .map(([key, value]) => ({ key, value }));
      onFilterChange(newFilters);
    }
  }

  function isColumnFiltered(columnKey: string) {
    const val = appliedFilterValues[columnKey];
    return val !== undefined && val !== "" && val !== null;
  }

  function toggleFilterExpanded(columnKey: string) {
    setExpandedFilters((prev) => ({
      ...prev,
      [columnKey]: !prev[columnKey],
    }));
  }

  function isFilterExpanded(columnKey: string) {
    return expandedFilters[columnKey];
  }

  const hasActiveFilters = Object.values(appliedFilterValues).some(
    (val) => val !== "" && val !== null && val !== undefined,
  );

  const activeFilterCount = Object.values(appliedFilterValues).filter(
    (val) => val !== "" && val !== null && val !== undefined,
  ).length;

  return (
    <div className="w-full flex flex-col gap-3 relative">
      {/* Active filters bar */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-text-tertiary">
            {activeFilterCount} filtro{activeFilterCount !== 1 ? "s" : ""} ativo{activeFilterCount !== 1 ? "s" : ""}
          </span>
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Limpar todos os filtros
          </button>
        </div>
      )}

      {/* No results warning */}
      {hasActiveFilters && data.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-900">
              Nenhum resultado encontrado com os filtros aplicados
            </span>
          </div>
          <button
            onClick={clearAllFilters}
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-md transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        </div>
      )}

      <div className="w-full bg-white rounded-lg shadow-[0_4px_12px_rgba(16,24,40,0.06),0_1px_3px_rgba(16,24,40,0.04)] relative overflow-hidden">
        {/* Table */}
        <div className="overflow-auto relative">
          <table className="min-w-full">
            {/* Header */}
            <thead>
              <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`p-3 border-b border-slate-100 relative text-left ${
                    column.width || ""
                  } h-11`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-text-tertiary text-sm font-semibold font-['Inter'] leading-5 whitespace-nowrap">
                      {column.header}
                    </div>

                    {/* Filter controls */}
                    {column.filterable && (
                      <div className="flex items-center gap-0.5">
                        {isColumnFiltered(column.key) && (
                          <button
                            onClick={() => handleClearColumnFilter(column.key)}
                            className="p-1 hover:bg-red-50 rounded transition-colors text-red-400 hover:text-red-600"
                            title="Remover filtro desta coluna"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => toggleFilterExpanded(column.key)}
                          className={`p-1 hover:bg-gray-100 rounded transition-colors ${
                            isColumnFiltered(column.key)
                              ? 'bg-blue-100 text-blue-700'
                              : isFilterExpanded(column.key)
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-gray-500'
                          }`}
                          title={isFilterExpanded(column.key) ? "Fechar busca" : "Buscar"}
                        >
                          <Search className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Filter Input - Floating Overlay */}
                  {column.filterable && isFilterExpanded(column.key) && (
                    <div className="absolute left-0 top-full z-50 p-2 bg-white border-b border-x border-border-default shadow-lg min-w-[240px]">
                      {column.filterType === "select" &&
                      column.filterOptions ? (
                        <div className="flex gap-1">
                          <select
                            value={getLocalFilterValue(column.key)}
                            onChange={(e) =>
                              handleApplyFilter(column.key, e.target.value)
                            }
                            className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                            autoFocus
                          >
                            <option value="">Todos</option>
                            {column.filterOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={getLocalFilterValue(column.key)}
                              onChange={(e) =>
                                handleLocalFilterChange(
                                  column.key,
                                  e.target.value,
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleApplyFilter(column.key);
                              }}
                              placeholder="Digite e confirme..."
                              className="w-full px-2 py-1.5 pr-7 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                            />
                            {getLocalFilterValue(column.key) && (
                              <button
                                onClick={() =>
                                  handleLocalFilterChange(column.key, "")
                                }
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                                title="Limpar texto"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <button
                            onClick={() => handleApplyFilter(column.key)}
                            className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            title="Aplicar filtro"
                          >
                            <Search className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </th>
              ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`p-3 align-middle ${
                      column.width || ""
                    } ${rowIndex < data.length - 1 ? "border-b border-slate-100" : ""}`}
                  >
                    <TruncatedText>
                      {column.render ? column.render(row) : row[column.key]}
                    </TruncatedText>
                  </td>
                ))}
              </tr>
            ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.enabled && (
          <div className="px-5 py-2.5 bg-white border-t border-slate-100 inline-flex justify-between items-center gap-5 w-full">
            {/* Items count */}
            <div className="flex-1 justify-start text-text-tertiary text-xs font-medium font-['Inter'] leading-4 tracking-tight">
              {startItem}-{endItem} de {total}
            </div>

            {/* Page size selector and pagination controls */}
            <div className="flex justify-end items-center gap-5">
              {/* Page size selector */}
              <div className="flex justify-start items-center gap-2.5">
                <div className="text-right justify-start text-text-tertiary text-xs font-medium font-['Inter'] leading-4 tracking-tight">
                  Linhas por página:
                </div>
                <div className="relative">
                  <button
                    ref={pageSizeButtonRef}
                    onClick={togglePageSizeDropdown}
                    className="flex justify-start items-center gap-0.5 focus:outline-none"
                  >
                    <div className="text-right justify-start text-text-tertiary text-xs font-medium font-['Inter'] leading-4 tracking-tight">
                      {pageSize}
                    </div>
                    <ChevronDown className="w-4 h-4 text-text-tertiary" />
                  </button>

                  {/* Dropdown */}
                  {showPageSizeDropdown &&
                    createPortal(
                      <>
                        <button
                          type="button"
                          aria-label="Fechar seletor de linhas por página"
                          className="fixed inset-0 z-50 cursor-default"
                          onClick={() => setShowPageSizeDropdown(false)}
                        />
                        <div
                          style={{
                            position: "fixed",
                            left: pageSizeDropdownPosition.left,
                            top: pageSizeDropdownPosition.top,
                            transform: "translateX(-100%)",
                            zIndex: 9999,
                          }}
                          className="bg-white border border-border-default rounded-md shadow-lg min-w-20"
                        >
                          {pageSizeOptions.map((option) => (
                            <button
                              key={option}
                              onClick={() => handlePageSizeChange(option)}
                              className={`w-full px-4 py-2 text-left text-xs hover:bg-slate-50 ${
                                option === pageSize
                                  ? "bg-slate-50 font-semibold"
                                  : ""
                              }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </>,
                      document.body,
                    )}
                </div>
              </div>

              {/* Pagination controls */}
              <div className="flex justify-center items-center gap-2.5">
                {/* Previous button */}
                <button
                  onClick={() => handlePageChange(internalPage - 1)}
                  disabled={internalPage === 1}
                  className={`px-1 py-0.5 rounded-md shadow-[0px_0px_0px_1px_rgba(70,79,96,0.24)] flex justify-center items-center overflow-hidden ${
                    internalPage === 1
                      ? "bg-slate-100 cursor-not-allowed opacity-50"
                      : "bg-slate-100 hover:bg-slate-200 cursor-pointer"
                  }`}
                >
                  <ChevronLeft className="w-4 h-4 text-text-tertiary" />
                </button>

                {/* Page indicator */}
                <div className="text-right justify-start text-text-tertiary text-xs font-medium font-['Inter'] leading-4 tracking-tight">
                  {internalPage}/{Math.max(totalPages, 1)}
                </div>

                {/* Next button */}
                <button
                  onClick={() => handlePageChange(internalPage + 1)}
                  disabled={internalPage >= totalPages || totalPages === 0}
                  className={`px-1 py-0.5 rounded-md shadow-[0px_2px_5px_0px_rgba(89,96,120,0.10)] shadow-[0px_0px_0px_1px_rgba(70,79,96,0.16)] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.10)] flex justify-center items-center overflow-hidden ${
                    internalPage >= totalPages || totalPages === 0
                      ? "bg-white cursor-not-allowed opacity-50"
                      : "bg-white hover:bg-slate-50 cursor-pointer"
                  }`}
                >
                  <ChevronRight className="w-4 h-4 text-text-tertiary" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
