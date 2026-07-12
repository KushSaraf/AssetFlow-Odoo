import React, { useState } from 'react';

interface KanbanColumn {
  id: string;
  name: string;
}

interface KanbanBoardProps<T> {
  columns: KanbanColumn[];
  items: T[];
  getColId: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
  onCardDrop: (itemId: string, targetColId: string) => void;
  getItemId: (item: T) => string;
}

export default function KanbanBoard<T>({
  columns,
  items,
  getColId,
  renderCard,
  onCardDrop,
  getItemId,
}: KanbanBoardProps<T>) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain') || draggedId;
    if (itemId) {
      onCardDrop(itemId, targetColId);
    }
    setDraggedId(null);
  };

  return (
    <div className="flex items-start gap-4 overflow-x-auto pb-4 h-full">
      {columns.map((col) => {
        const colItems = items.filter((item) => getColId(item) === col.id);

        return (
          <div
            key={col.id}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
            className="flex w-72 shrink-0 flex-col rounded-sm border border-[#E3E3E6] bg-white max-h-full"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between border-b border-[#E3E3E6] bg-[#F7F7F8] px-3 py-2 shrink-0">
              <span className="text-xs font-semibold text-[#1F1F1F]">{col.name}</span>
              <span className="rounded-full bg-white border border-[#E3E3E6] px-2 py-0.5 text-[10px] font-medium text-[#6C757D]">
                {colItems.length}
              </span>
            </div>

            {/* Column Body */}
            <div className="overflow-y-auto space-y-2 p-2 bg-[#F7F7F8]/50 min-h-[60px]">
              {colItems.length === 0 ? (
                <div className="flex h-32 items-center justify-center border border-dashed border-[#E3E3E6] rounded-sm text-[11px] text-[#6C757D]">
                  Drag items here
                </div>
              ) : (
                colItems.map((item) => {
                  const id = getItemId(item);
                  return (
                    <div
                      key={id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, id)}
                      className={`cursor-grab active:cursor-grabbing rounded-sm border border-[#E3E3E6] bg-white p-3 shadow-sm hover:border-[#714B67] transition-all ${
                        draggedId === id ? 'opacity-50 border-[#714B67]' : ''
                      }`}
                    >
                      {renderCard(item)}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
