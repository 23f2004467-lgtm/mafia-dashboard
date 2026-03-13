import React, { useState } from 'react';
import { theme } from '../../styles/theme';

/**
 * Professional Table Component
 * Responsive, sortable, and accessible data table
 */
const Table = ({
  columns = [],
  data = [],
  keyField = 'id',
  sortable = false,
  onRowClick = null,
  emptyMessage = 'No data available',
  className = '',
  ...props
}) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const handleSort = (column) => {
    if (!sortable || !column.sortable) return;

    const direction =
      sortConfig.key === column.key && sortConfig.direction === 'asc' ? 'desc' : 'asc';

    setSortConfig({ key: column.key, direction });
  };

  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  const renderSortIcon = (column) => {
    if (!sortable || !column.sortable) return null;

    if (sortConfig.key !== column.key) {
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: '4px', opacity: 0.5 }}>
          <path d="M6 2v8M2 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    }

    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: '4px' }}>
        {sortConfig.direction === 'asc' ? (
          <path d="M6 2v8M2 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        ) : (
          <path d="M6 10V2M2 6l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        )}
      </svg>
    );
  };

  return (
    <div className={`table-container ${className}`} style={{ overflowX: 'auto' }}>
      <table
        className="table"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: theme.typography.fontSize.sm,
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.borderRadius.lg,
          overflow: 'hidden',
        }}
        {...props}
      >
        <thead>
          <tr
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {columns.map((column) => (
              <th
                key={column.key}
                className="table-header-cell"
                style={{
                  padding: theme.spacing.md,
                  textAlign: 'left',
                  fontWeight: theme.typography.fontWeight.semibold,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.text.secondary,
                  cursor: sortable && column.sortable ? 'pointer' : 'default',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => handleSort(column)}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {column.label}
                  {renderSortIcon(column)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: `${theme.spacing.xl} ${theme.spacing.md}`,
                  textAlign: 'center',
                  color: theme.colors.text.disabled,
                  fontSize: theme.typography.fontSize.base,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: theme.spacing.md }}>
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.5 }}>
                    <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="2"/>
                    <path d="M16 20h16M16 28h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  {emptyMessage}
                </div>
              </td>
            </tr>
          ) : (
            sortedData.map((row, rowIndex) => (
              <tr
                key={row[keyField] || rowIndex}
                className="table-row"
                style={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  transition: `background-color ${theme.transitions.fast}`,
                  cursor: onRowClick ? 'pointer' : 'default',
                }}
                onClick={() => onRowClick && onRowClick(row)}
                onMouseEnter={(e) => {
                  if (onRowClick) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="table-cell"
                    style={{
                      padding: theme.spacing.md,
                      color: theme.colors.text.primary,
                    }}
                  >
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Loading Table Skeleton
 */
export const TableSkeleton = ({ rows = 5, columns = 5 }) => (
  <div className="table-skeleton" style={{ padding: theme.spacing.md }}>
    {[...Array(rows)].map((_, rowIndex) => (
      <div
        key={rowIndex}
        style={{
          display: 'flex',
          gap: theme.spacing.md,
          padding: `${theme.spacing.md} 0`,
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {[...Array(columns)].map((_, colIndex) => (
          <div
            key={colIndex}
            style={{
              flex: 1,
              height: '40px',
              borderRadius: theme.borderRadius.md,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
              backgroundSize: '200% 100%',
              animation: 'skeleton-loading 1.5s infinite',
            }}
          />
        ))}
      </div>
    ))}
    <style>{`
      @keyframes skeleton-loading {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
    `}</style>
  </div>
);

export default Table;
