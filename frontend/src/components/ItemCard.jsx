import { useState, useEffect } from 'react';

const STATUS_COLORS = {
  pending: '#f59e0b',
  'in-progress': '#3b82f6',
  completed: '#10b981',
};

const STATUS_LABELS = {
  pending: 'Pending',
  'in-progress': 'In Progress',
  completed: 'Completed',
};

export default function ItemCard({ item, onEdit, onDelete }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    setIsDeleting(true);
    try {
      await onDelete(item._id);
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <div
      style={{
        ...styles.card,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
      }}
    >
      <div style={styles.header}>
        <h3 style={styles.name}>{item.name}</h3>
        <span
          style={{
            ...styles.badge,
            backgroundColor: `${STATUS_COLORS[item.status]}20`,
            color: STATUS_COLORS[item.status],
            borderColor: `${STATUS_COLORS[item.status]}40`,
          }}
        >
          {STATUS_LABELS[item.status]}
        </span>
      </div>

      {item.description && <p style={styles.desc}>{item.description}</p>}

      <div style={styles.meta}>
        <span style={styles.date}>
          Created {new Date(item.createdAt).toLocaleDateString()}
        </span>
      </div>

      <div style={styles.actions}>
        <button
          style={styles.editBtn}
          onClick={() => onEdit(item)}
          aria-label={`Edit ${item.name}`}
        >
          ✏️ Edit
        </button>
        <button
          style={{
            ...styles.deleteBtn,
            opacity: isDeleting ? 0.5 : 1,
          }}
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label={`Delete ${item.name}`}
        >
          {isDeleting ? '⏳' : '🗑️'} Delete
        </button>
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
    border: '1px solid #f0f0f5',
    transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  },
  name: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#1a1a2e',
    lineHeight: 1.3,
    wordBreak: 'break-word',
  },
  badge: {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: '20px',
    border: '1px solid',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  desc: {
    margin: 0,
    fontSize: '0.9rem',
    color: '#6b7280',
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  meta: {
    display: 'flex',
    gap: '8px',
  },
  date: {
    fontSize: '0.78rem',
    color: '#9ca3af',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '4px',
  },
  editBtn: {
    flex: 1,
    padding: '8px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    background: '#fafafa',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#374151',
    transition: 'all 0.2s',
  },
  deleteBtn: {
    flex: 1,
    padding: '8px 14px',
    border: '1px solid #fee2e2',
    borderRadius: '10px',
    background: '#fef2f2',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#dc2626',
    transition: 'all 0.2s',
  },
};
