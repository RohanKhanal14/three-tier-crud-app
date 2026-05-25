import { useState, useEffect, useRef } from 'react';

export default function FilterBar({ onFilter }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debounceRef = useRef(null);

  // Debounce search input by 350ms
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFilter({ search, status });
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [search, status]);

  const handleClear = () => {
    setSearch('');
    setStatus('');
  };

  const hasFilters = search || status;

  return (
    <div style={styles.bar}>
      <div style={styles.searchWrap}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          type="text"
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
          aria-label="Search items"
        />
      </div>

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        style={styles.select}
        aria-label="Filter by status"
      >
        <option value="">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="in-progress">In Progress</option>
        <option value="completed">Completed</option>
      </select>

      {hasFilters && (
        <button style={styles.clearBtn} onClick={handleClear}>
          ✕ Clear
        </button>
      )}
    </div>
  );
}

const styles = {
  bar: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  searchWrap: {
    flex: 1,
    minWidth: '220px',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '14px',
    fontSize: '1rem',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    padding: '12px 14px 12px 42px',
    borderRadius: '12px',
    border: '1px solid #d1d5db',
    fontSize: '0.95rem',
    outline: 'none',
    background: '#fff',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  select: {
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid #d1d5db',
    fontSize: '0.95rem',
    outline: 'none',
    background: '#fff',
    fontFamily: 'inherit',
    cursor: 'pointer',
    minWidth: '150px',
  },
  clearBtn: {
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    background: '#f9fafb',
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#6b7280',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
};
