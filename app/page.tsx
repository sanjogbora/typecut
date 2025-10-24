import FontSwitcherClient from "./font-switcher-client"
import Link from 'next/link'

export default function Page() {
  return (
    <div className="h-full flex flex-col">
      {/* Main Content - Takes remaining space */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-2 min-h-0">
        <section className="w-full max-w-7xl h-full flex items-center justify-center">
          <FontSwitcherClient />
        </section>
      </main>
      
      {/* Footer - Compact */}
      <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-center items-center gap-6">
            <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              About
            </Link>
            <a 
              href="https://www.instagram.com/sanjogsays/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              @sanjogsays
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
