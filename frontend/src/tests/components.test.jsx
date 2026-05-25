import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ItemForm from '../components/ItemForm';
import ItemCard from '../components/ItemCard';
import FilterBar from '../components/FilterBar';

// ── ItemForm Tests ─────────────────────────────────────────────────────────────
describe('ItemForm', () => {
  it('renders create form by default', () => {
    render(<ItemForm onSubmit={vi.fn()} onCancel={vi.fn()} editingItem={null} />);
    expect(screen.getByText('✨ New Item')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter item name…')).toBeInTheDocument();
  });

  it('renders edit form when editingItem is provided', () => {
    const item = { name: 'Edit Me', description: 'Desc', status: 'in-progress' };
    render(<ItemForm editingItem={item} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('✏️ Edit Item')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Edit Me')).toBeInTheDocument();
  });

  it('shows error when submitting empty name', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ItemForm editingItem={null} onSubmit={onSubmit} onCancel={vi.fn()} />);

    const submitBtn = screen.getByText('➕ Create');
    await user.click(submitBtn);

    expect(screen.getByText('Item name is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with form data', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({});
    render(<ItemForm editingItem={null} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter item name…'), 'New Task');
    await user.type(screen.getByPlaceholderText('Optional description…'), 'A description');
    await user.click(screen.getByText('➕ Create'));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'New Task',
      description: 'A description',
      status: 'pending',
    });
  });

  it('shows cancel button in edit mode', () => {
    const item = { name: 'Test', description: '', status: 'pending' };
    const onCancel = vi.fn();
    render(<ItemForm editingItem={item} onSubmit={vi.fn()} onCancel={onCancel} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });
});

// ── ItemCard Tests ─────────────────────────────────────────────────────────────
describe('ItemCard', () => {
  const mockItem = {
    _id: '123',
    name: 'Sample Item',
    description: 'A sample description',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('renders item name and description', () => {
    render(<ItemCard item={mockItem} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Sample Item')).toBeInTheDocument();
    expect(screen.getByText('A sample description')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<ItemCard item={mockItem} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<ItemCard item={mockItem} onEdit={onEdit} onDelete={vi.fn()} />);

    await user.click(screen.getByLabelText('Edit Sample Item'));
    expect(onEdit).toHaveBeenCalledWith(mockItem);
  });

  it('renders in-progress status correctly', () => {
    const inProgressItem = { ...mockItem, status: 'in-progress' };
    render(<ItemCard item={inProgressItem} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders completed status correctly', () => {
    const completedItem = { ...mockItem, status: 'completed' };
    render(<ItemCard item={completedItem} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});

// ── FilterBar Tests ────────────────────────────────────────────────────────────
describe('FilterBar', () => {
  it('renders search input and status select', () => {
    render(<FilterBar onFilter={vi.fn()} />);
    expect(screen.getByPlaceholderText('Search items…')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by status')).toBeInTheDocument();
  });

  it('calls onFilter when status is changed', async () => {
    const user = userEvent.setup();
    const onFilter = vi.fn();
    render(<FilterBar onFilter={onFilter} />);

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'completed');

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(onFilter).toHaveBeenCalled();
  });
});
