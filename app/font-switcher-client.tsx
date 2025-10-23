"use client"

import dynamic from "next/dynamic"

const FontSwitcherCanvas = dynamic(() => import("../components/font-switcher-canvas"), {
  ssr: false,
})

export default function FontSwitcherClient() {
  return <FontSwitcherCanvas />
}
