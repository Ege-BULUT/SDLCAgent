import Markdown from 'react-markdown';

interface Props {
  feedback: string;
  isValid: boolean;
  liveContent?: string;
  streaming?: boolean;
  label?: string;
}

export default function ReviewFeedback({ feedback, isValid, liveContent, streaming, label }: Props) {
  const content = streaming && liveContent != null ? liveContent : feedback;

  if (!content && !streaming) {
    return (
      <div className="bg-dark-800 rounded-lg border border-dark-600 flex flex-col h-full">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider px-4 pt-4 pb-2">
          {label || 'Review Feedback'}
        </h2>
        <div className="flex-1 flex items-center justify-center px-4 pb-4">
          <p className="text-gray-500 text-sm italic">No feedback yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 rounded-lg border border-dark-600 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          {label || 'Review Feedback'}
          {streaming && <span className="ml-2 text-yellow-400 text-[10px] animate-pulse">● LIVE</span>}
        </h2>
        {!streaming && content && (
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              isValid
                ? 'bg-green-900 text-green-300 border border-green-600'
                : 'bg-red-900 text-red-300 border border-red-600'
            }`}
          >
            {isValid ? 'PASS' : 'FAIL'}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 text-sm text-gray-300 leading-relaxed prose prose-invert prose-sm max-w-none min-h-0">
        <Markdown>{content}</Markdown>
        {streaming && (
          <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-0.5" />
        )}
      </div>
    </div>
  );
}
