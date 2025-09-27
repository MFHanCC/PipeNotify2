import React, { useState, useMemo } from 'react';
import './AdvancedDataTable.css';

interface TableColumn {
  key: string;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: 'text' | 'select';
  filterOptions?: string[];
  formatter?: (value: any, row?: any) => string | React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface AdvancedDataTableProps {
  data: any[];
  columns: TableColumn[];
  title?: string;
  searchable?: boolean;
  exportable?: boolean;
  pagination?: boolean;
  itemsPerPage?: number;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: any) => void;
}

const AdvancedDataTable: React.FC<AdvancedDataTableProps> = ({
  data,
  columns,
  title,
  searchable = true,
  exportable = true,
  pagination = true,
  itemsPerPage = 10,
  isLoading = false,
  emptyMessage = "No data available",
  onRowClick
}) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Filter and search data
  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(row =>
        columns.some(col => {
          const value = row[col.key];
          return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
        })
      );
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
      if (filterValue) {
        const column = columns.find(col => col.key === columnKey);
        
        filtered = filtered.filter(row => {
          const value = row[columnKey];
          
          // Handle success rate range filtering
          if (columnKey === 'successRate' && column?.filterType === 'select') {
            const percentage = Math.round(value * 100);
            switch (filterValue) {
              case '95-100%':
                return percentage >= 95;
              case '80-94%':
                return percentage >= 80 && percentage < 95;
              case '50-79%':
                return percentage >= 50 && percentage < 80;
              case '0-49%':
                return percentage < 50;
              default:
                return true;
            }
          }
          
          // Handle regular text/select filtering
          return value && value.toString().toLowerCase().includes(filterValue.toLowerCase());
        });
      }
    });

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        
        if (aVal === bVal) return 0;
        
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        
        return sortDirection === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [data, searchTerm, columnFilters, sortColumn, sortDirection, columns]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    if (!pagination) return filteredData;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage, pagination]);

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const handleColumnFilter = (columnKey: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: value
    }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  const exportToCSV = () => {
    const csvContent = [
      columns.map(col => col.title).join(','),
      ...filteredData.map(row =>
        columns.map(col => {
          const value = row[col.key];
          return `"${value || ''}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'data'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (isLoading) {
    return (
      <div className="advanced-data-table loading">
        {title && <div className="table-title skeleton-title"></div>}
        <div className="table-controls">
          <div className="skeleton-search"></div>
          <div className="skeleton-buttons"></div>
        </div>
        <div className="table-skeleton">
          <div className="skeleton-header">
            {[...Array(columns.length)].map((_, i) => (
              <div key={i} className="skeleton-header-cell"></div>
            ))}
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-row">
              {[...Array(columns.length)].map((_, j) => (
                <div key={j} className="skeleton-cell"></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="advanced-data-table">
      {title && <h3 className="table-title">{title}</h3>}
      
      <div className="table-controls">
        <div className="controls-left">
          {searchable && (
            <div className="search-container">
              <input
                type="text"
                placeholder="Search table..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <span className="search-icon">🔍</span>
            </div>
          )}
          <div className="results-info">
            Showing {paginatedData.length} of {filteredData.length} results
          </div>
        </div>
        
        <div className="controls-right">
          {columns.some(col => col.filterable) && (
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
            >
              <span className="filter-icon">🔽</span> Filters
            </button>
          )}
          {exportable && (
            <button onClick={exportToCSV} className="export-btn">
              📊 Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Column Filters */}
      {showFilters && (
        <div className="column-filters">
          {columns.filter(col => col.filterable).map(col => (
            <div key={col.key} className="filter-group">
              <label>{col.title}:</label>
              {col.filterType === 'select' && col.filterOptions ? (
                <select
                  value={columnFilters[col.key] || ''}
                  onChange={(e) => handleColumnFilter(col.key, e.target.value)}
                  className="filter-select"
                >
                  <option value="">All {col.title}</option>
                  {col.filterOptions.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder={`Filter ${col.title.toLowerCase()}...`}
                  value={columnFilters[col.key] || ''}
                  onChange={(e) => handleColumnFilter(col.key, e.target.value)}
                  className="filter-input"
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`table-header ${col.sortable ? 'sortable' : ''} align-${col.align || 'left'}`}
                  style={{ width: col.width }}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="header-content">
                    <span>{col.title}</span>
                    {col.sortable && (
                      <span className="sort-icon">{getSortIcon(col.key)}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="empty-cell">
                  <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    <div className="empty-message">{emptyMessage}</div>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr
                  key={index}
                  className={`table-row ${onRowClick ? 'clickable' : ''}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={`table-cell align-${col.align || 'left'}`}
                    >
                      {col.formatter ? col.formatter(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="pagination-btn"
          >
            ← Previous
          </button>
          
          <div className="page-numbers">
            {[...Array(totalPages)].map((_, i) => {
              const page = i + 1;
              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 2 && page <= currentPage + 2)
              ) {
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`page-btn ${currentPage === page ? 'active' : ''}`}
                  >
                    {page}
                  </button>
                );
              } else if (page === currentPage - 3 || page === currentPage + 3) {
                return <span key={page} className="pagination-ellipsis">...</span>;
              }
              return null;
            })}
          </div>
          
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="pagination-btn"
          >
            Next →
          </button>
        </div>
      )}

      {/* Footer Info */}
      <div className="table-footer">
        <div className="footer-info">
          Total: {data.length} items
          {searchTerm && ` • Filtered: ${filteredData.length} items`}
          {pagination && ` • Page ${currentPage} of ${totalPages}`}
        </div>
      </div>
    </div>
  );
};

export default AdvancedDataTable;