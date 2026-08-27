import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';

export default function HelpCenter() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto text-center py-20 animate-in zoom-in-95 duration-500">
      <HelpCircle className="mx-auto text-blue-600 mb-6" size={64} />
      <h2 className="text-2xl font-bold mb-2 text-slate-900">Need Help?</h2>
      <p className="text-slate-500 mb-8 leading-relaxed">Refer to the Econet Internal SOP Manual or ask Tadiwa for real-time guidance on any helpdesk issue.</p>
      <button
        onClick={() => navigate('/')}
        className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/20 transition-all"
      >
        Back to Hub
      </button>
    </div>
  );
}
