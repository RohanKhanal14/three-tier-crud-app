import { useState, useEffect } from 'react';

export default function ItemForm({ editingItem, onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('pending');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Populate form when editing
  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name || '');
      setDescription(editingItem.description || '');
      setStatus(editingItem.status || 'pending');
      setError('');
    } else {
      resetForm();
    }
  }, [editingItem]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setStatus('pending');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Item name is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onSubmit({
        name: trimmedName,
        description: description.trim(),
        status,
      });
      if (!editingItem) resetForm();
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const isEditing = !!editingItem;

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2 style={styles.title}>{isEditing ? '✏️ Edit Item' : '✨ New Item'}</h2>

      {error && <div style={styles.error} role="alert">{error}</div>}

      <div style={styles.field}>
        <label htmlFor="item-name" style={styles.label}>Name *</label>
        <input
          id="item-name"
          type="text"
          placeholder="Enter item name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
          maxLength={200}
          autoFocus
        />
      </div>

      <div style={styles.field}>
        <label htmlFor="item-desc" style={styles.label}>Description</label>
        <textarea
          id="item-desc"
          placeholder="Optional description…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={styles.textarea}
          rows={3}
          maxLength={2000}
        />
      </div>

      <div style={styles.field}>
        <label htmlFor="item-status" style={styles.label}>Status</label>
        <select
          id="item-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={styles.select}
        >
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div style={styles.actions}>
        <button
          type="submit"
          style={{
            ...styles.submitBtn,
            opacity: submitting ? 0.6 : 1,
          }}
          disabled={submitting}
        >
          {submitting
            ? '⏳ Saving…'
            : isEditing
            ? '💾 Update'
            : '➕ Create'}
        </button>

        {isEditing && (
          <button
            type="button"
            style={styles.cancelBtn}
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

const styles = {
  form: {
    background: 'linear-gradient(135deg, #667eea08, #764ba208)',
    borderRadius: '20px',
    padding: '28px',
    border: '1px solid #e8e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  title: {
    margin: 0,
    fontSize: '1.3rem',
    fontWeight: 700,
    color: '#1a1a2e',
  },
  error: {
    background: '#fef2f2',
    color: '#dc2626',
    padding: '10px 14px',
    borderRadius: '10px',
    fontSize: '0.88rem',
    border: '1px solid #fecaca',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#4b5563',
  },
  input: {
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit',
  },
  textarea: {
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    fontSize: '0.95rem',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  select: {
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    fontSize: '0.95rem',
    outline: 'none',
    background: '#fff',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    marginTop: '4px',
  },
  submitBtn: {
    flex: 1,
    padding: '12px 20px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  },
  cancelBtn: {
    padding: '12px 20px',
    borderRadius: '12px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#6b7280',
    fontSize: '0.95rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  },
};
