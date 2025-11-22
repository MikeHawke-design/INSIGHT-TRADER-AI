
import React from 'react';

const Highlight: React.FC<{ children: React.ReactNode, color?: 'yellow' | 'blue' | 'purple' | 'green' | 'red' }> = ({ children, color = 'yellow' }) => {
    const colorClasses = {
        yellow: 'text-yellow-400',
        blue: 'text-blue-400',
        purple: 'text-purple-400',
        green: 'text-green-400',
        red: 'text-red-400',
    };
    return <strong className={`${colorClasses[color]} font-semibold`}>{children}</strong>;
};

const Section: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="py-8 border-b border-gray-700/50 last:border-b-0">
        <h3 className="text-2xl font-display font-bold text-yellow-400 mb-4 uppercase tracking-wide">{title}</h3>
        <div className="space-y-4 text-gray-300 leading-relaxed prose prose-sm prose-invert max-w-none prose-strong:text-yellow-200 prose-headings:text-yellow-200 prose-a:text-blue-400 hover:prose-a:text-blue-300">{children}</div>
    </div>
);

const UserManualView: React.FC = () => {
    return (
        <div className="max-w-4xl mx-auto p-6 md:p-8 bg-gray-900/40 rounded-xl border border-white/5 backdrop-blur-sm">
            <div className="text-center mb-10">
                <h2 className="text-4xl font-display font-bold text-white tracking-wider mb-2">INSIGHT TRADER</h2>
                <p className="text-yellow-500/60 font-mono text-sm tracking-widest uppercase">Operational Manual v3.0</p>
            </div>
            
            <Section title="🚀 Full Access Enabled">
                <p>Welcome to INSIGHT TRADER. The platform has been unlocked to provide full, unrestricted access to all AI analysis and educational tools.</p>
                <p>To get started:</p>
                <ol>
                    <li><strong>Data Feed (Optional):</strong> Navigate to <Highlight>System > Data Management</Highlight> to fetch EODHD market data if you have a key, or simply use image uploads for analysis.</li>
                    <li><strong>Terminal Access:</strong> Enter the <Highlight>Terminal</Highlight> view.</li>
                    <li><strong>Configuration:</strong>
                        <ul>
                            <li>Select a strategy (e.g., "Candlestick Pattern Trading Foundation").</li>
                            <li>In "Add Context", upload chart screenshots.</li>
                        </ul>
                    </li>
                    <li><strong>Execution:</strong> Engage the <Highlight>Analyze</Highlight> function.</li>
                </ol>
            </Section>

            <Section title="🔮 The Terminal">
                <p>Primary command center for market operations.</p>
                <h4>Trade Setup</h4>
                <p>Generate actionable intelligence:</p>
                <ol>
                    <li><strong>Strategy:</strong> Select the logic core.</li>
                    <li><strong>Parameters:</strong> Adjust risk profile and R:R targets.</li>
                    <li><strong>Context:</strong> Inject market data via Image Upload (screenshots of your chart) or Cached Data.</li>
                </ol>
                
                <h4>Guided Learning</h4>
                <p>Interactive coaching module to master specific strategies via the AI interface.</p>
            </Section>

            <Section title="📊 Analysis Results">
                <p>Post-process output:</p>
                <ul>
                    <li><Highlight color="green">Longs & Shorts:</Highlight> Directional setups with precise Entry, SL, and TP coordinates.</li>
                    <li><Highlight color="purple">Oracle's Suggestion:</Highlight> Meta-analysis advising on strategy suitability for current conditions.</li>
                    <li><Highlight>Journaling:</Highlight> Save high-probability setups to the permanent record.</li>
                </ul>
            </Section>

            <Section title="📓 The Journal">
                <p>Performance tracking database.</p>
                <ul>
                    <li><strong>Trade Log:</strong> Track PnL and outcome metrics (<Highlight color="green">TP</Highlight>, <Highlight color="red">SL</Highlight>).</li>
                    <li><strong>Mentorship:</strong> Archive of coaching sessions.</li>
                    <li><strong>Comparisons:</strong> Historical record of market scans.</li>
                </ul>
            </Section>

            <Section title="⚙️ System Control">
                <p>Global configuration panel.</p>
                <h4>Strategies</h4>
                <p>Manage logic blueprints. Create new strategies from documents via the AI ingestion engine.</p>
                <h4>Data Management</h4>
                <p>Control local storage, cache market data, and execute full system backups.</p>
            </Section>
        </div>
    );
};

export default UserManualView;
