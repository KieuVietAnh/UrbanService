 

import { Inbox } from 'lucide-react';

function EmptyState({ title = 'Không có dữ liệu', description = '', action = null, detail = '', icon: Icon = Inbox }) {
  const message = description || detail || '';

  return (
    <div className="flex flex-col items-center rounded-[1.5rem] border border-slate-200 bg-white px-6 py-10 text-center shadow-sm sm:px-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
        <Icon size={24} />
      </div>
      <div className="mt-4 max-w-md">
        <div className="text-base font-black text-slate-900">{title}</div>
        {message ? <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p> : null}
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
