/**
 * Empty State Component
 * 
 * Beautiful empty state display for tables with no data.
 * Matches the design pattern with centered content and illustrations.
 */

import { FileX, Inbox, CheckCircle2, XCircle, Truck } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: 'inbox' | 'file-x' | 'check' | 'x-circle' | 'truck' | 'file-text';
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ 
  title, 
  description, 
  icon = 'inbox',
  action 
}: EmptyStateProps) {
  function getIcon() {
    const iconClass = "w-16 h-16 text-gray-300";
    
    switch (icon) {
      case 'file-x':
        return <FileX className={iconClass} />;
      case 'check':
        return <CheckCircle2 className={iconClass} />;
      case 'x-circle':
        return <XCircle className={iconClass} />;
      case 'truck':
        return <Truck className={iconClass} />;
      case 'inbox':
      default:
        return <Inbox className={iconClass} />;
    }
  };

  return (
    <div className="w-full bg-white rounded-lg outline-1 -outline-offset-1px outline-gray-200 flex flex-col items-center justify-center py-16 px-6">
      {/* Icon */}
      <div className="mb-4">
        {getIcon()}
      </div>

      {/* Title */}
      <h3 className="text-slate-900 text-lg font-semibold font-['Inter'] leading-6 mb-2 text-center">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-gray-500 text-sm font-normal font-['Inter'] leading-5 text-center max-w-md mb-6">
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className="h-10 px-4 py-2 bg-[#184367] rounded-lg flex justify-center items-center gap-2 hover:bg-[#0f2d4a] transition-colors"
        >
          <span className="text-white text-sm font-bold font-['Inter']">
            {action.label}
          </span>
        </button>
      )}
    </div>
  );
}
