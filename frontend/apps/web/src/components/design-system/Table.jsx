import clsx from './clsx';

function Table({ columns = [], data = [], className }) {
  return (
    <div className="overflow-x-auto">
      <table className={clsx('table w-full text-sm', className)}>
        <thead>
          <tr className="bg-slate-50 text-slate-400 font-black uppercase tracking-[0.18em] text-xs">
            {columns.map((c) => (
              <th key={c.key} className="py-3">{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50/60">
              {columns.map((c) => (
                <td key={c.key} className="py-3">{c.render ? c.render(row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
