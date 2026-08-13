import { createContext } from 'react';

export interface CommunicationItem {
  id: string | number;
  title?: string;
  content?: string;
  type?: string;
  sender_name?: string;
  recipient_id?: string | null;
  created_at: string;
  isRead?: boolean;
  target_audience?: string;
}

export interface NotificationContextType {
  unreadCount: number;
  readIds: string[];
  deletedIds: string[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteMessage: (id: string) => void;
  notifications: CommunicationItem[];
  loading: boolean;
  refreshNotifications: () => Promise<void>;
}

export const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  readIds: [],
  deletedIds: [],
  markAsRead: () => {},
  markAllAsRead: () => {},
  deleteMessage: () => {},
  notifications: [],
  loading: true,
  refreshNotifications: async () => {},
});
