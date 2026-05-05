import React, { useState } from 'react';

const questions = [
  { id: 1, text: "The government should regulate major industries to protect consumers.", category: "Economic" },
  { id: 2, text: "Individual liberty should always take precedence over collective security.", category: "Social" },
  { id: 3, text: "Military intervention is justified to spread democratic values.", category: "Foreign" },
];

function App() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);

  const handleAnswer = (questionId, score) => {
    setAnswers({ ...answers, [questionId]: score });
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      calculateResults();
    }
  };

  const calculateResults = async () => {
    // Simulate API call to backend
    setResults({
      summary: "Balanced Progressive",
      scores: { Economic: 75, Social: 80, Foreign: 40 }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 font-inter text-gray-900">
      <nav className="p-6 bg-white border-b border-gray-200 flex justify-between items-center">
        <h1 className="font-montserrat text-2xl font-extrabold tracking-tight text-indigo-600">
          VOTER ARCHITECT
        </h1>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition">
          Sign in with Google
        </button>
      </nav>

      <main className="max-w-3xl mx-auto py-12 px-6">
        {!results ? (
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
            <div className="mb-8">
              <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">
                Step {step + 1} of {questions.length}
              </span>
              <h2 className="font-montserrat text-3xl mt-2 leading-tight">
                {questions[step].text}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"].map((label, idx) => (
                <button
                  key={label}
                  onClick={() => handleAnswer(questions[step].id, idx - 2)}
                  className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all font-medium"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-fade-in">
            <h2 className="font-montserrat text-4xl mb-6">Your Political Leaning</h2>
            <div className="bg-white p-8 rounded-2xl shadow-2xl border-t-4 border-indigo-500">
              <p className="text-xl mb-4">You align most closely with: <span className="font-bold text-indigo-600">{results.summary}</span></p>
              
              <div className="space-y-6">
                {Object.entries(results.scores).map(([cat, score]) => (
                  <div key={cat}>
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold">{cat}</span>
                      <span>{score}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${score}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>

              <button className="mt-10 w-full bg-gray-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition">
                <span>📂</span> Export Detailed Report to Google Drive
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
