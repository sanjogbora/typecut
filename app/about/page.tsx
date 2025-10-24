import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Zap, Download, Type, Video, FileImage, Code } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'About TypeCut - Animated Font Switching Tool',
  description: 'Learn how TypeCut creates stunning animated font switching effects for social media content. Perfect for Instagram, TikTok, and YouTube creators.',
  keywords: 'font animation, text effects, social media content, Instagram stories, TikTok videos, font switching, animated text, video editing, typeface animation, typography effects, rapid font change, font morphing, text transitions, animated typography, font transitions, text morphing, typeface switching, dynamic typography, viral text effects, social media typography, Instagram font effects, TikTok text animation, YouTube typography, font cycling, text animation tool, typography animation software',
}

export default function AboutPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-16">
          {/* Demo GIF as title */}
          <div className="mb-6 max-w-2xl mx-auto">
            <img
              src="/hero-gif.gif"
              alt="TypeCut font animation demo showing rapid font switching effects"
              className="w-full h-auto rounded-lg"
              loading="eager"
            />
          </div>

          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-4xl mx-auto leading-relaxed">
            Create stunning animated font switching effects, typography animations, and rapid font transitions for social media. Perfect for Instagram Stories, TikTok videos, YouTube content, and viral text effects.
          </p>

          <div className="flex flex-wrap gap-4 justify-center mb-16 max-w-5xl mx-auto">
            <div className="px-4 py-2 bg-muted rounded-full text-sm">Font Animation</div>
            <div className="px-4 py-2 bg-muted rounded-full text-sm">Typography Effects</div>
            <div className="px-4 py-2 bg-muted rounded-full text-sm">Text Morphing</div>
            <div className="px-4 py-2 bg-muted rounded-full text-sm">Typeface Animation</div>
            <div className="px-4 py-2 bg-muted rounded-full text-sm">Rapid Font Switching</div>
            <div className="px-4 py-2 bg-muted rounded-full text-sm">Font Transitions</div>
            <div className="px-4 py-2 bg-muted rounded-full text-sm">Animated Typography</div>
            <div className="px-4 py-2 bg-muted rounded-full text-sm">Social Media Effects</div>
          </div>

          <Link href="/">
            <Button size="lg" className="text-lg px-8 py-3">
              Try It Now <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>

        {/* What It Does */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">What is TypeCut?</h2>
          <div className="prose prose-lg max-w-none text-muted-foreground">
            <p className="text-center text-xl leading-relaxed">
              TypeCut is a powerful web-based tool that creates eye-catching animated text effects by rapidly switching between different fonts.
              Perfect for social media content creators, designers, and anyone looking to add dynamic typography to their projects.
            </p>
          </div>
        </section>

        {/* Features Grid */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-12 text-center">Key Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-lg border bg-card">
              <Zap className="h-12 w-12 mx-auto mb-4 text-foreground" />
              <h3 className="text-xl font-semibold mb-3">Lightning Fast</h3>
              <p className="text-muted-foreground">
                Create animations in seconds with our intuitive interface. No complex software required.
              </p>
            </div>

            <div className="text-center p-6 rounded-lg border bg-card">
              <Type className="h-12 w-12 mx-auto mb-4 text-foreground" />
              <h3 className="text-xl font-semibold mb-3">Font Library</h3>
              <p className="text-muted-foreground">
                Access hundreds of Google Fonts plus your system fonts. Mix and match for unique effects.
              </p>
            </div>

            <div className="text-center p-6 rounded-lg border bg-card">
              <Download className="h-12 w-12 mx-auto mb-4 text-foreground" />
              <h3 className="text-xl font-semibold mb-3">Multiple Formats</h3>
              <p className="text-muted-foreground">
                Export as WebM, GIF, or After Effects scripts. Perfect for any platform or workflow.
              </p>
            </div>
          </div>
        </section>

        {/* Export Options */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-12 text-center">Export Options</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-lg border bg-card">
              <Video className="h-12 w-12 mx-auto mb-4 text-foreground" />
              <h3 className="text-xl font-semibold mb-3">WebM Video</h3>
              <p className="text-muted-foreground mb-4">
                High-quality video format with transparent background support. Perfect for overlays and compositing.
              </p>
              <div className="text-sm text-muted-foreground">
                ✓ Transparent background<br />
                ✓ High quality<br />
                ✓ Small file size
              </div>
            </div>

            <div className="text-center p-6 rounded-lg border bg-card">
              <FileImage className="h-12 w-12 mx-auto mb-4 text-foreground" />
              <h3 className="text-xl font-semibold mb-3">Animated GIF</h3>
              <p className="text-muted-foreground mb-4">
                Crisp, hard-edged GIFs optimized for social media. Works everywhere with sharp text quality.
              </p>
              <div className="text-sm text-muted-foreground">
                ✓ Universal compatibility<br />
                ✓ Sharp text edges<br />
                ✓ Optimized colors
              </div>
            </div>

            <div className="text-center p-6 rounded-lg border bg-card">
              <Code className="h-12 w-12 mx-auto mb-4 text-foreground" />
              <h3 className="text-xl font-semibold mb-3">After Effects</h3>
              <p className="text-muted-foreground mb-4">
                Export as .jsx script for Adobe After Effects. Full control over timing and customization.
              </p>
              <div className="text-sm text-muted-foreground">
                ✓ Professional workflow<br />
                ✓ Full customization<br />
                ✓ Keyframe animation
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-12 text-center">Perfect For</h2>
          <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-center md:text-left">Social Media Creators</h3>
              <ul className="space-y-3 text-muted-foreground">
                <li>• Instagram Stories and Reels</li>
                <li>• TikTok videos and transitions</li>
                <li>• YouTube thumbnails and intros</li>
                <li>• Twitter/X video content</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-center md:text-left">Professionals</h3>
              <ul className="space-y-3 text-muted-foreground">
                <li>• Video editors and motion designers</li>
                <li>• Brand designers and marketers</li>
                <li>• Content agencies and studios</li>
                <li>• Freelance creators</li>
              </ul>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-12 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-foreground text-background rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">1</div>
              <h3 className="font-semibold mb-3">Enter Text</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Type your message or brand name</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-foreground text-background rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">2</div>
              <h3 className="font-semibold mb-3">Select Fonts</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Choose from hundreds of fonts</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-foreground text-background rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">3</div>
              <h3 className="font-semibold mb-3">Customize</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Adjust timing, size, and colors</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-foreground text-background rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">4</div>
              <h3 className="font-semibold mb-3">Export</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Download in your preferred format</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-16 bg-muted/50 rounded-lg">
          <h2 className="text-3xl font-bold mb-4">Ready to Create Amazing Font Effects?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Start creating stunning animated text effects in seconds
          </p>
          <Link href="/">
            <Button size="lg" className="text-lg px-8 py-3">
              Get Started Now <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </section>

        {/* Footer */}
        <footer className="text-center mt-16 pt-8 border-t">
          <p className="text-muted-foreground">
            Created by{' '}
            <a
              href="https://www.instagram.com/sanjogsays/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:underline"
            >
              @sanjogsays
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}