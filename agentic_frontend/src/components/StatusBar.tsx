interface Props {
  coderModel: string;
  reviewerModel: string;
  lastAction: string;
  iterations: number;
  onHelpClick?: () => void;
}

export default function StatusBar({ coderModel, reviewerModel, lastAction, iterations, onHelpClick }: Props) {
  return (
    <footer className="flex items-center justify-between px-4 py-1.5 bg-dark-950 border-t border-dark-600 text-xs text-gray-500">
      <div className="flex items-center gap-4">
        {coderModel && (
          <span>
            Coder: <span className="text-gray-300 font-medium">{coderModel}</span>
          </span>
        )}
        {reviewerModel && (
          <span>
            Reviewer: <span className="text-gray-300 font-medium">{reviewerModel}</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        {lastAction && <span>Last: {lastAction}</span>}
        {iterations > 0 && <span>Iterations: {iterations}</span>}
        {onHelpClick && (
          <button
            onClick={onHelpClick}
            title="Help & About"
            className="text-gray-400 hover:text-gray-200 transition-colors text-sm font-bold"
          >
            ?
          </button>
        )}
      </div>
    </footer>
  );
}
