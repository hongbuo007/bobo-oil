import type { ReactNode } from 'react';
import { Empty } from 'antd';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <Empty
        image={icon || Empty.PRESENTED_IMAGE_SIMPLE}
        description={null}
      />
      <div className="text-base font-medium text-gray-700 mt-4">{title}</div>
      {description && (
        <div className="text-sm text-gray-400 mt-2 text-center max-w-xs">{description}</div>
      )}
      {action && (
        <div className="mt-6">{action}</div>
      )}
    </div>
  );
}
