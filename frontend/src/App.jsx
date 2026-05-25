import { useState, useEffect, useCallback } from 'react';
import ItemForm from './components/ItemForm';
import ItemCard from './components/ItemCard';
import FilterBar from './components/FilterBar';
import { fetchItems, createItem, updateItem, deleteItem } from './services/api';

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: '' });

  // Fetch items with current filters
  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchItems(filters.search, filters.status);
      setItems(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load items. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Create or update
  const handleSubmit = async (itemData) => {
    if (editingItem) {
      const updated = await updateItem(editingItem._id, itemData);
      setItems((prev) =>
        prev.map((i) => (i._id === updated._id ? updated : i))
      );
      setEditingItem(null);
    } else {
      const created = await createItem(itemData);
      setItems((prev) => [created, ...prev]);
    }
  };

  // Delete
  const handleDelete = async (id) => {
    await deleteItem(id);
    setItems((prev) => prev.filter((i) => i._id !== id));
  };

  // Edit
  const handleEdit = (item) => {
    setEditingItem(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => setEditingItem(null);

  const handleFilter = (newFilters) => setFilters(newFilters);

  return (
    <>
      <style>{globalStyles}</style>
      <div style={styles.wrapper}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerContent}>
            <h1 style={styles.logo}>
              <span style={styles.logoIcon}>📦</span> CRUD Manager
            </h1>
            <p style={styles.tagline}>
              Manage your items with a clean, modern interface
            </p>
          </div>
        </header>

        <main style={styles.main}>
          {/* Form Section */}
          <section style={styles.formSection}>
            <ItemForm
              editingItem={editingItem}
              onSubmit={handleSubmit}
              onCancel={handleCancelEdit}
            />
          </section>

          {/* Items Section */}
          <section style={styles.itemsSection}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>
                Items{' '}
                <span style={styles.count}>({items.length})</span>
              </h2>
            </div>

            <FilterBar onFilter={handleFilter} />

            {/* Loading state */}
            {loading && (
              <div style={styles.stateBox}>
                <div style={styles.spinner} />
                <p style={styles.stateText}>Loading items…</p>
              </div>
            )}

            {/* Error state */}
            {error && !loading && (
              <div style={styles.errorBox} role="alert">
                <p style={styles.errorText}>⚠️ {error}</p>
                <button style={styles.retryBtn} onClick={loadItems}>
                  Retry
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && items.length === 0 && (
              <div style={styles.stateBox}>
                <p style={{ fontSize: '2.5rem', margin: 0 }}>🫙</p>
                <p style={styles.stateText}>
                  {filters.search || filters.status
                    ? 'No items match your filters'
                    : 'No items yet — create your first one above!'}
                </p>
              </div>
            )}

            {/* Items grid */}
            {!loading && !error && items.length > 0 && (
              <div style={styles.grid}>
                {items.map((item) => (
                  <ItemCard
                    key={item._id}
                    item={item}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </section>
        </main>

        {/* Footer */}
        <footer style={styles.footer}>
          <p style={styles.footerText}>
            Three-Tier CRUD App &middot; React + Express + MongoDB
          </p>
        </footer>
      </div>
    </>
  );
}

// ── Global styles (injected via <style> tag) ───────────────────────────────────
const globalStyles = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: linear-gradient(135deg, #f5f7fa, #e4e8f0);
    min-height: 100vh;
    color: #1a1a2e;
    -webkit-font-smoothing: antialiased;
  }
  input:focus, textarea:focus, select:focus {
    border-color: #667eea !important;
    box-shadow: 0 0 0 3px rgba(102,126,234,0.15) !important;
  }
  button:hover { filter: brightness(0.95); }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

// ── Inline styles ──────────────────────────────────────────────────────────────
const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    padding: '40px 24px',
    textAlign: 'center',
    color: '#fff',
  },
  headerContent: {
    maxWidth: '700px',
    margin: '0 auto',
  },
  logo: {
    fontSize: '2rem',
    fontWeight: 700,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
  logoIcon: {
    fontSize: '2.2rem',
  },
  tagline: {
    marginTop: '8px',
    fontSize: '1rem',
    opacity: 0.85,
    fontWeight: 400,
  },
  main: {
    flex: 1,
    maxWidth: '960px',
    width: '100%',
    margin: '0 auto',
    padding: '32px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  formSection: {},
  itemsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0,
  },
  count: {
    fontSize: '1rem',
    fontWeight: 500,
    color: '#9ca3af',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
  },
  stateBox: {
    textAlign: 'center',
    padding: '48px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  stateText: {
    color: '#9ca3af',
    fontSize: '1rem',
    margin: 0,
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#667eea',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '14px',
    padding: '20px 24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  errorText: {
    color: '#dc2626',
    margin: 0,
    fontSize: '0.95rem',
  },
  retryBtn: {
    padding: '8px 20px',
    borderRadius: '10px',
    border: '1px solid #fca5a5',
    background: '#fff',
    color: '#dc2626',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  footer: {
    textAlign: 'center',
    padding: '24px',
    borderTop: '1px solid #e5e7eb',
  },
  footerText: {
    margin: 0,
    fontSize: '0.85rem',
    color: '#9ca3af',
  },
};
