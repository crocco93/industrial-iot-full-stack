import React from 'react';

interface Props {
  x: number;
  y: number;
  onClose: () => void;
  options: Array<{ label: string; action: () => void; }>;
}

export const ContextMenu: React.FC<Props> = ({ x, y, onClose, options }) => {
  return (
    <div 
      className="fixed bg-white shadow-lg border rounded py-1 z-50"
      style={{ left: x, top: y }}
    >
      {options.map((option, index) => (
        <button
          key={index}
          className="block w-full text-left px-4 py-2 hover:bg-gray-100"
          onClick={() => {
            option.action();
            onClose();
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};