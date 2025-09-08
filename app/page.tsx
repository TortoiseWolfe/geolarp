'use client'

import { useState } from 'react'

export default function Home() {
  const [isStarted, setIsStarted] = useState(false)

  const handleStartAdventure = () => {
    setIsStarted(true)
    // For now, just show a message. Will navigate to character creation in future PRPs
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4 text-geolarp-primary">
          geoLARP
        </h1>
        <p className="text-xl mb-8">
          Location-Based RPG with D7 Dice Mechanics
        </p>
        <div className="space-y-4">
          <p className="text-gray-400">
            Transform the real world into your game board
          </p>
          {!isStarted ? (
            <button 
              onClick={handleStartAdventure}
              className="bg-geolarp-primary hover:bg-green-600 text-black font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Start Adventure
            </button>
          ) : (
            <div className="text-geolarp-primary">
              <p className="text-2xl mb-2">Adventure begins!</p>
              <p className="text-sm text-gray-400">Character creation coming in PRP-006...</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}