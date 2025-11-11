"use client";

import { Header } from "@/components/ui/header";

export default function Prizes() {
  return (
    <div className="bg-gray-100 min-h-screen">
      <Header />
      <main className="px-6 py-16 min-h-[calc(100vh-60px)]">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
              Workshop Prizes
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              The top 3 participants will be rewarded! 
            </p>
          </div>

          {/* How It Works */}
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 space-y-6 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900">How It Works</h2>
            
            <div className="space-y-4 text-gray-700">
              <p>
                To make this workshop engaging and meaningful, you&apos;ll earn points for your participation throughout the session. For each vote, the organizer will explain how points are awarded. Your point balance will update asynchronously once the organizer submits allocations to the smart contract.
              </p>
              
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 space-y-3">
                <p className="font-semibold text-gray-900 flex items-start gap-2">
                  <span className="text-blue-600 text-xl">ℹ️</span>
                  <span>Note:</span>
                </p>
                <p className="ml-8 text-gray-700">
                  The point allocation system directly rewards participation, but also incorporates a random factor from group assignments, as well as the impact of group voting outcomes influenced by other participants&apos; choices.
                </p>
              </div>


            </div>
          </div>

          {/* Prizes */}
          <div className="space-y-6">
            {/* First Prize */}
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl border-2 border-yellow-400 p-8 shadow-lg">
              <div className="flex items-start gap-4 mb-4">
                <span className="text-5xl">🥇</span>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    First Place
                  </h3>
                  <p className="text-lg font-semibold text-gray-800 mb-4">
                    Parallel Society 2026 Package
                  </p>
                  
                  <div className="space-y-3 text-gray-800">
                    <div className="flex items-start gap-2">
                      <span className="font-bold">✓</span>
                      <span>Two free ticket to <a href="https://ps.logos.co/" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-900 font-semibold">Parallel Society 2026</a> in Lisbon (March 6 - 7, 2026)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold">✓</span>
                      <span>Hotel accommodation in Lisbon during the event (2 nights, double room)</span>
                    </div>
                    <p className="text-sm text-gray-600 italic ml-6">
                      *Travel to Lisbon not included
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t-2 border-yellow-300">
                <p className="text-sm text-gray-700">
                Parallel Society Festival is a grassroots, community co-created gathering of forward-thinking network states, free cities, parallel societies, pop-up villages, intentional communities, and those advancing human governance beyond nation states. This 2026 edition in Lisbon is the latest evolution of the Parallel Society Congress, which first took place in Bangkok in 2025.
                </p>
              </div>
            </div>

            {/* Second and Third Prize */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-gray-400 p-8 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="flex gap-2 text-4xl">
                  <span>🥈</span>
                  <span>🥉</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Second & Third Place
                  </h3>
                  <p className="text-lg font-semibold text-gray-800 mb-4">
                    &quot;Farewell to Westphalia&quot; Books by Jarrad Hope and Peter Ludlow
                  </p>
                  
                  <div className="space-y-3 text-gray-800">
                    <div className="flex items-start gap-2">
                      <span className="font-bold">✓</span>
                      <span>
                        <a 
                          href="https://www.amazon.com/Farewell-Westphalia-Sovereignty-Post-Nation-State-Governance/dp/B0FQLV79ZN" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="underline hover:text-gray-900 font-semibold"
                        >
                          Farewell to Westphalia: Sovereignty and the Post-Nation-State Governance
                        </a>
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t-2 border-gray-300">
                    <p className="text-sm text-gray-700">
                      An essential read exploring sovereignty and governance beyond traditional nation-states.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center py-8">
            <p className="text-gray-600">
              Winners will be announced at the end of the workshop. Good luck! 🎉
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

