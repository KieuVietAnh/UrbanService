import * as Lucide from 'lucide-react';

const getFileType = (fileName = '') => {
  const name = fileName.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.match(/\.(png|jpe?g|gif|webp|svg)$/)) return 'image';
  return 'document';
};

const getIcon = (type) => {
  switch (type) {
    case 'pdf': return <Lucide.FileText className="h-5 w-5" />;
    case 'image': return <Lucide.Image className="h-5 w-5" />;
    default: return <Lucide.File className="h-5 w-5" />;
  }
};

export default function CompletionDocumentsCard({
  documents = [],
  onPreview,
  onDownload,
  emptyMessage = 'No completion documents available.',
}) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Completion Documents</div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {documents.length === 0 ? (
          <div className="rounded-[1.2rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">{emptyMessage}</div>
        ) : documents.map((document, index) => {
          const fileName = document?.fileName || document?.name || `document-${index + 1}`;
          const type = getFileType(fileName);
          const uploadedBy = document?.uploadedBy || document?.uploadedByName || document?.createdByName || '—';
          const uploadDate = document?.uploadDate || document?.createdAt || document?.uploadedAt || '—';
          const description = typeof document?.description === 'string' && document.description.trim()
            ? document.description
            : (typeof document?.descriptionText === 'string' && document.descriptionText.trim() ? document.descriptionText : 'No description');
          const fileUrl = document?.fileUrl || document?.url || document?.downloadUrl || document?.documentUrl;

          return (
            <div key={`${fileName}-${index}`} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">{getIcon(type)}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-800">{fileName}</div>
                  <div className="mt-1 text-xs text-slate-500">{uploadDate}</div>
                  <div className="mt-1 text-xs text-slate-400">Uploaded by: {uploadedBy}</div>
                  <div className="mt-2 text-sm text-slate-600">{description}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {type === 'image' && fileUrl && onPreview ? (
                  <button
                    type="button"
                    onClick={() => onPreview(document, index)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"
                  >
                    <Lucide.Eye size={14} /> Preview
                  </button>
                ) : null}

                {fileUrl ? (
                  <button
                    type="button"
                    onClick={() => onDownload?.(document)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"
                  >
                    <Lucide.Download size={14} /> Download
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
