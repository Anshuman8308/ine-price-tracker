import { Code, Briefcase, Mail, Info } from 'lucide-react';

export default function About() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm border border-blue-100">
          <Info className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-2xl font-bold font-outfit text-slate-900">About</h2>
          <p className="text-slate-500">Project details and developer information.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className="p-8 space-y-8">
          
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">PriceTracker</h3>
            <p className="text-slate-700 leading-relaxed max-w-2xl text-lg">
              A price and stock monitoring platform built to track product availability, price changes, scrape history, and monitoring events.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Built By</h3>
            <div className="text-slate-800">
              <p className="font-semibold text-lg">Anshuman Singh</p>
              <p className="text-slate-500">Jaypee Institute of Information Technology, Noida</p>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Project</h3>
            <p className="text-slate-800 font-medium">INE Software Engineer Intern Assignment</p>
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Technology</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center font-semibold text-slate-700 shadow-sm">React</div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center font-semibold text-slate-700 shadow-sm">Node.js / Express</div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center font-semibold text-slate-700 shadow-sm">PostgreSQL / Supabase</div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center font-semibold text-slate-700 shadow-sm">Playwright</div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Links</h3>
            <div className="flex flex-wrap gap-4">
              <a href="https://github.com/Anshuman8308/ine-price-tracker" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm font-medium">
                <Code className="w-5 h-5" />
                GitHub
              </a>
              <a href="https://www.linkedin.com/in/anshuman-singh-a1708a25b/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm font-medium">
                <Briefcase className="w-5 h-5" />
                LinkedIn
              </a>
              <a href="mailto:anshuman83080@gmail.com" className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm font-medium">
                <Mail className="w-5 h-5 text-slate-400" />
                Email
              </a>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
