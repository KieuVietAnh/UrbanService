export default function LoadingSpinner({ size = 24 }) {
  return (
    <div className="flex items-center justify-center">
      <span className="loading loading-spinner" style={{ width: size, height: size }} />
    </div>
  );
}
