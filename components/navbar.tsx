import Link from 'next/link'
import { Instagram } from 'lucide-react'

export default function Navbar() {
  return (
    <nav className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-foreground hover:text-foreground/80 transition-colors">
              TypeCut
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link href="/about" className="text-base font-semibold text-foreground hover:text-muted-foreground transition-colors px-3 py-2 rounded-md border border-border hover:bg-muted">
              About
            </Link>
            <a 
              href="https://www.instagram.com/sanjogsays/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Follow on Instagram"
            >
              <Instagram className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </nav>
  )
}
