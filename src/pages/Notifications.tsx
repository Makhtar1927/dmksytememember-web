import { useState } from 'react';
import { createPortal } from 'react-dom';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bell, Mail, MessageSquare, Smartphone, CheckCheck, Clock, X, Trash2 } from 'lucide-react';
import { useNotifications } from '../lib/useNotifications';

export default function Notifications() {
  const { notifications, loading, readIds, markAsRead, markAllAsRead, deleteMessage } = useNotifications();
  const [activeFilter, setActiveFilter] = useState('Toutes');
  const [selectedMessage, setSelectedMessage] = useState<any>(null);

  const enhancedNotifications = notifications.map(n => ({
    ...n,
    isRead: readIds.includes(n.id.toString())
  }));

  const filteredNotifications = enhancedNotifications.filter(n => {
    if (activeFilter === 'Non lues') return !n.isRead;
    if (activeFilter === 'Lues') return n.isRead;
    return true;
  });

  const getIconConfig = (type: string, isRead: boolean) => {
    switch (type) {
      case 'Email': 
        return { Icon: Mail, color: isRead ? 'text-slate-400' : 'text-blue-500', bg: isRead ? 'bg-slate-50' : 'bg-blue-100' };
      case 'SMS': 
        return { Icon: Smartphone, color: isRead ? 'text-slate-400' : 'text-emerald-500', bg: isRead ? 'bg-slate-50' : 'bg-emerald-100' };
      case 'Push Mobile': 
        return { Icon: Bell, color: isRead ? 'text-slate-400' : 'text-amber-500', bg: isRead ? 'bg-slate-50' : 'bg-amber-100' };
      default: 
        return { Icon: MessageSquare, color: isRead ? 'text-slate-400' : 'text-blue-600', bg: isRead ? 'bg-slate-50' : 'bg-blue-100' };
    }
  };

  const handlePressMessage = (item: any) => {
    markAsRead(item.id.toString());
    setSelectedMessage(item);
  };

  const filters = ['Toutes', 'Non lues', 'Lues'];
  const unreadCountLocal = enhancedNotifications.filter(n => !n.isRead).length;

  return (
    <div className="flex flex-col relative pb-44 md:pb-8 h-full min-h-screen">
      <div className="sticky top-0 z-30 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-2xl border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-all">
        <div className="flex items-center justify-between p-5 md:p-8 pb-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">Boîte de réception</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5 font-medium text-sm md:text-lg transition-colors">Vos alertes DMK</p>
          </div>
          <button 
            onClick={markAllAsRead}
            className="flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-[16px] bg-blue-100/80 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-200 dark:hover:bg-blue-500/30 shadow-inner"
            title="Tout marquer comme lu"
          >
            <CheckCheck size={22} />
          </button>
        </div>

        <div className="flex gap-2.5 overflow-x-auto px-5 md:px-8 pb-3.5 custom-scrollbar">
          {filters.map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`whitespace-nowrap rounded-[16px] px-4 sm:px-5 py-2 text-xs sm:text-sm font-black transition-all border ${
                activeFilter === filter 
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-md' 
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {filter} {filter === 'Non lues' && unreadCountLocal > 0 ? `(${unreadCountLocal})` : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 md:p-8 pb-8 max-w-4xl w-full mx-auto space-y-4 z-10">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent shadow-lg"></div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col h-64 items-center justify-center text-center rounded-[32px] bg-white/60 dark:bg-slate-900/50 border border-white/50 dark:border-slate-700/50 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 p-8 transition-colors">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[24px] bg-slate-100/50 dark:bg-slate-800/50 shadow-inner">
              <Bell size={48} className="text-slate-300 dark:text-slate-600 stroke-[1.5px]" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight transition-colors">Aucune alerte</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm font-medium transition-colors">Vous n'avez aucun message dans cette catégorie.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotifications.map(item => {
              const createdAt = parseISO(item.created_at);
              const { Icon, color, bg } = getIconConfig(item.type ?? '', item.isRead ?? false);

              return (
                <button
                  key={item.id}
                  onClick={() => handlePressMessage(item)}
                  className={`relative w-full overflow-hidden rounded-[24px] border p-5 text-left transition-all duration-300 focus:outline-none group ${
                    !item.isRead 
                      ? 'border-blue-300/50 dark:border-blue-500/30 bg-white/80 dark:bg-blue-900/20 shadow-lg shadow-blue-100/50 dark:shadow-blue-900/20 backdrop-blur-xl hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-200/50 dark:hover:shadow-blue-900/40' 
                      : 'border-white/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/50 shadow-md shadow-slate-200/30 dark:shadow-slate-900/30 backdrop-blur-xl hover:-translate-y-1 hover:shadow-lg'
                  }`}
                >
                  {!item.isRead && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-400 to-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]"></div>
                  )}

                  <div className="flex items-start">
                    <div className={`mr-4 mt-0.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] shadow-inner transition-colors ${
                      item.isRead ? 'bg-slate-100/50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500' : `${bg.replace('bg-', 'bg-').replace('-100', '-100/80 dark:bg-opacity-20')} ${color}`
                    }`}>
                      <Icon size={24} className="drop-shadow-sm group-hover:scale-110 transition-transform" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className={`truncate text-base mr-3 transition-colors ${!item.isRead ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-600 dark:text-slate-400'}`}>
                          {item.title}
                        </h4>
                        <div className="flex shrink-0 items-center">
                          {!item.isRead && <Clock size={12} className="mr-1 text-blue-600 dark:text-blue-400" />}
                          <span className={`text-xs transition-colors ${!item.isRead ? 'font-black text-blue-600 dark:text-blue-400' : 'font-bold text-slate-400 dark:text-slate-500'}`}>
                            {format(createdAt, 'dd MMM', { locale: fr })}
                          </span>
                        </div>
                      </div>

                      <p className={`mb-4 line-clamp-2 text-sm leading-relaxed transition-colors ${!item.isRead ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-500 dark:text-slate-500'}`}>
                        {item.content}
                      </p>

                      <div className="flex items-center justify-between">
                        <span className={`inline-block rounded-[10px] px-3 py-1.5 text-[11px] font-black uppercase tracking-wider shadow-sm transition-colors ${
                          item.isRead ? 'bg-slate-100/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400' : `${bg.replace('-100', '-100/80 dark:bg-opacity-20')} ${color}`
                        }`}>
                          {item.type}
                        </span>
                        <span className="text-xs font-black text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">Lire la suite</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {/* Espace de défilement massif pour éviter le masquage par la barre de navigation et le FAB */}
            <div className="h-44 w-full shrink-0" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Modal Desktop/Mobile */}
      {selectedMessage && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4 backdrop-blur-md transition-all">
          <div 
            className="w-full sm:max-w-xl max-h-[90vh] bg-white/90 dark:bg-slate-900/90 border border-white/20 dark:border-slate-700/50 rounded-t-[32px] sm:rounded-[32px] shadow-2xl shadow-black/20 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-4 duration-300"
          >
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 p-6 md:p-8 pb-4">
              <span className="rounded-[12px] bg-slate-100/80 dark:bg-slate-800/80 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300 shadow-sm transition-colors">
                {selectedMessage.type}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    deleteMessage(selectedMessage.id.toString());
                    setSelectedMessage(null);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-red-50/80 dark:bg-red-500/10 text-red-500 dark:text-red-400 transition-colors hover:bg-red-100 dark:hover:bg-red-500/20 shadow-inner"
                  title="Supprimer l'alerte"
                >
                  <Trash2 size={20} />
                </button>
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 shadow-inner"
                  title="Fermer"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-6 md:p-8 pt-4 pb-12 custom-scrollbar">
              <h2 className="text-2xl md:text-3xl font-black leading-tight text-slate-900 dark:text-white mb-3 transition-colors tracking-tight">
                {selectedMessage.title}
              </h2>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-6 transition-colors">
                Envoyé le {format(parseISO(selectedMessage.created_at), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
              </p>

              <div className="h-px w-full bg-slate-200/50 dark:bg-slate-800/50 mb-8"></div>

              <div className="text-base leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-medium transition-colors">
                {selectedMessage.content}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
