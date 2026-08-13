import { useContext } from 'react';
import { NotificationContext } from './NotificationContextDef';

export const useNotifications = () => useContext(NotificationContext);
