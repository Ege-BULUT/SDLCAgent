import Markdown from 'react-markdown';

interface Props {
  feedback: string;
  isValid: boolean;
}

export default function ReviewFeedback({ feedback, isValid }: Props) {
  if (!feedback) {
    return (
      <div className="bg-dark-800 rounded-lg border border-dark-600 p-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Review Feedback</h2>
        <p className="text-gray-500 text-sm italic">No feedback yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 rounded-lg border border-dark-600 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Review Feedback</h2>
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            isValid
              ? 'bg-green-900 text-green-300 border border-green-600'
              : 'bg-red-900 text-red-300 border border-red-600'
          }`}
        >
          {isValid ? 'PASS' : 'FAIL'}
        </span>
      </div>
      <div className="text-sm text-gray-300 leading-relaxed prose prose-invert prose-sm max-w-none">
        <Markdown>{feedback}</Markdown>
      </div>
    </div>
  );
}
