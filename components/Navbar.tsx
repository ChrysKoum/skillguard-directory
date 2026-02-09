import Link from "next/link";
import Image from "next/image";

export function Navbar() {
    return (
        <nav className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <Link href="/" className="flex items-center gap-2 group">
                        <Image
                            src="/logo_64_64.png"
                            alt="SkillGuard Logo"
                            width={32}
                            height={32}
                            className="group-hover:scale-105 transition-transform"
                        />
                        <span className="font-bold text-xl tracking-tight text-slate-100">
                            Skill<span className="text-indigo-500">Guard</span> Directory
                        </span>
                    </Link>
                    <div className="flex gap-6">
                        <Link href="/" className="text-slate-400 hover:text-white text-sm font-medium transition-colors">Home</Link>
                        <Link href="/scan" className="text-slate-400 hover:text-white text-sm font-medium transition-colors">Scan Agent</Link>
                        <Link href="/about" className="text-slate-400 hover:text-white text-sm font-medium transition-colors">About</Link>
                    </div>
                </div>
            </div>
        </nav>
    );
}
