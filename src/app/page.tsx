import Link from 'next/link';
import { RetroGrid } from '@/components/RetroGrid';
import Image from 'next/image';
import DisplayCards from '@/components/DisplayCard';
import { BarChart3, ShieldCheck, Zap, TrendingUp, LineChart, Trophy } from 'lucide-react';
import { EvervaultCard } from '@/components/EvervaultCard';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center">
            <span className="text-xl font-bold text-blue-600">BetWise</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link 
              href="/auth/login" 
              className="rounded-md px-4 py-2 text-gray-600 hover:text-blue-600"
            >
              Sign In
            </Link>
            <Link 
              href="/auth/register" 
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section with RetroGrid */}
      <section className="relative bg-white dark:bg-black overflow-hidden min-h-[720px] flex">
        {/* RetroGrid Background */}
        <RetroGrid angle={45} />
        
        <div className="container relative mx-auto px-6 w-full self-center">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-4 lg:gap-6 items-end">
            {/* Left side - Text */}
            <div className="flex flex-col z-10 md:pb-24 lg:pb-28 xl:pb-32">
              <h1 className="mb-6 text-6xl font-bold text-gray-900 dark:text-white md:text-7xl">
                India's Smartest<br />
                <span className="text-blue-600 dark:text-blue-400">Skill Gaming Platform</span>
              </h1>
              <p className="mb-8 text-2xl text-gray-700 dark:text-gray-300">
                Sports, Entertainment, Economy or Finance.
              </p>
              <div className="flex flex-col space-y-3 sm:flex-row sm:space-x-4 sm:space-y-0">
                <Link 
                  href="/auth/register" 
                  className="rounded-md bg-blue-600 px-8 py-4 text-center text-xl font-medium text-white hover:bg-blue-700"
                >
                  Trade Online
                </Link>
                <Link 
                  href="#how-it-works" 
                  className="rounded-md border border-blue-600 bg-white px-8 py-4 text-center text-xl font-medium text-blue-600 hover:bg-blue-50 dark:bg-transparent dark:text-white dark:hover:bg-blue-950"
                >
                  Download App
                </Link>
              </div>
              <div className="mt-6 text-base text-gray-600 dark:text-gray-400">
                For 18 years and above only
              </div>
            </div>
            
            {/* Right side - Image/Illustration */}
            <div className="flex items-end justify-center z-10">
              <div className="w-full">
                <Image
                  src="/images/image1.png"
                  alt="BetWise Trading"
                  width={1100}
                  height={1100}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section with DisplayCards */}
      <section className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-gray-900 md:text-5xl">
              Premium Trading Features
            </h2>
            <p className="mx-auto max-w-2xl text-xl text-gray-600">
              Our platform offers advanced tools designed to give you the edge in sports trading markets.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className="flex flex-col gap-8">
              <DisplayCards 
                cards={[
                  {
                    icon: <BarChart3 className="size-4 text-blue-300" />,
                    title: "Real-time Analytics",
                    description: "Track market movements as they happen",
                    date: "Live updates",
                    className: "[grid-area:stack] hover:-translate-y-10 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration:700 hover:grayscale-0 before:left-0 before:top-0",
                  },
                  {
                    icon: <ShieldCheck className="size-4 text-green-300" />,
                    title: "Secure Trading",
                    description: "Bank-level security for all transactions",
                    date: "Always protected",
                    titleClassName: "text-green-500",
                    className: "[grid-area:stack] translate-x-16 translate-y-10 hover:-translate-y-1 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration:700 hover:grayscale-0 before:left-0 before:top-0",
                  },
                  {
                    icon: <Zap className="size-4 text-yellow-300" />,
                    title: "Instant Execution",
                    description: "Zero-lag order processing",
                    date: "Lightning fast",
                    titleClassName: "text-yellow-500",
                    className: "[grid-area:stack] translate-x-32 translate-y-20 hover:translate-y-10",
                  },
                ]}
              />
            </div>
            
            <div className="flex flex-col gap-8">
              <DisplayCards 
                cards={[
                  {
                    icon: <TrendingUp className="size-4 text-purple-300" />,
                    title: "Predictive Models",
                    description: "AI-powered insights for better decisions",
                    date: "Smart predictions",
                    titleClassName: "text-purple-500",
                    className: "[grid-area:stack] hover:-translate-y-10 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration:700 hover:grayscale-0 before:left-0 before:top-0",
                  },
                  {
                    icon: <LineChart className="size-4 text-pink-300" />,
                    title: "Advanced Charting",
                    description: "Professional-grade technical analysis",
                    date: "Data visualization",
                    titleClassName: "text-pink-500",
                    className: "[grid-area:stack] translate-x-16 translate-y-10 hover:-translate-y-1 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration:700 hover:grayscale-0 before:left-0 before:top-0",
                  },
                  {
                    icon: <Trophy className="size-4 text-orange-300" />,
                    title: "Leaderboards",
                    description: "Compete with top traders worldwide",
                    date: "Daily rankings",
                    titleClassName: "text-orange-500",
                    className: "[grid-area:stack] translate-x-32 translate-y-20 hover:translate-y-10",
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Image and Text Section 1 */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 items-center">
            {/* Left Image */}
            <div className="order-2 md:order-1">
              <Image
                src="/images/image2.png"
                alt="Advanced Trading Tools"
                width={600}
                height={500}
                className="rounded-lg shadow-lg object-cover"
                priority
              />
            </div>
            
            {/* Right Text */}
            <div className="order-1 md:order-2">
              <h2 className="mb-6 text-3xl font-bold text-gray-900 md:text-4xl">
                Advanced Trading Tools for Sports Enthusiasts
              </h2>
              <p className="mb-6 text-lg text-gray-700">
                BetWise offers sophisticated trading tools that help you make informed decisions. Our platform provides real-time analytics, performance tracking, and market sentiment indicators to give you an edge.
              </p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <svg className="mr-2 h-6 w-6 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Live match statistics and visualizations</span>
                </li>
                <li className="flex items-start">
                  <svg className="mr-2 h-6 w-6 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Historical performance data and trend analysis</span>
                </li>
                <li className="flex items-start">
                  <svg className="mr-2 h-6 w-6 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Custom alerts and notifications for market movements</span>
                </li>
              </ul>
              <div className="mt-8">
                <Link 
                  href="/features" 
                  className="inline-flex items-center text-blue-600 font-medium hover:text-blue-800"
                >
                  Explore all features
                  <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Image and Text Section 2 */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 items-center">
            {/* Left Text */}
            <div>
              <h2 className="mb-6 text-3xl font-bold text-gray-900 md:text-4xl">
                Seamless Trading Experience Across All Devices
              </h2>
              <p className="mb-6 text-lg text-gray-700">
                Stay connected to the markets wherever you are. BetWise offers a fully responsive design that works flawlessly on desktop, tablet, and mobile devices.
              </p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <svg className="mr-2 h-6 w-6 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Fast and responsive mobile-first design</span>
                </li>
                <li className="flex items-start">
                  <svg className="mr-2 h-6 w-6 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Instant notifications and real-time updates</span>
                </li>
                <li className="flex items-start">
                  <svg className="mr-2 h-6 w-6 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Secure biometric login on supported devices</span>
                </li>
              </ul>
              <div className="mt-8">
                <Link 
                  href="/mobile" 
                  className="inline-flex items-center text-blue-600 font-medium hover:text-blue-800"
                >
                  Learn about our mobile app
                  <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                  </svg>
                </Link>
              </div>
            </div>
            
            {/* Right Image */}
            <div>
              <Image
                src="/images/image3.png"
                alt="Mobile Trading Experience"
                width={600}
                height={500}
                className="rounded-lg shadow-lg object-cover ml-auto"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-gray-50 py-24 overflow-hidden">
        <div className="container mx-auto px-4">
          <h2 className="mb-16 text-center text-4xl font-bold text-gray-900 md:text-5xl">
            How It Works
          </h2>
          
          <div className="grid grid-cols-1 gap-16 md:grid-cols-4">
            <div className="flex flex-col items-center text-center group">
              <div className="mb-8 h-64 w-64 transform transition-transform duration-500 group-hover:scale-105">
                <EvervaultCard 
                  text="1" 
                  className="from-blue-500 to-blue-700"
                />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-gray-900">Create Account</h3>
              <p className="text-gray-600 max-w-xs">
                Register and verify your account to join our trading community.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center group">
              <div className="mb-8 h-64 w-64 transform transition-transform duration-500 group-hover:scale-105">
                <EvervaultCard 
                  text="2" 
                  className="from-green-500 to-green-700"
                />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-gray-900">Fund Wallet</h3>
              <p className="text-gray-600 max-w-xs">
                Add funds to your wallet to start trading on sports markets.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center group">
              <div className="mb-8 h-64 w-64 transform transition-transform duration-500 group-hover:scale-105">
                <EvervaultCard 
                  text="3" 
                  className="from-purple-500 to-purple-700"
                />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-gray-900">Place Orders</h3>
              <p className="text-gray-600 max-w-xs">
                Browse markets and place buy or sell orders at your desired prices.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center group">
              <div className="mb-8 h-64 w-64 transform transition-transform duration-500 group-hover:scale-105">
                <EvervaultCard 
                  text="4" 
                  className="from-orange-500 to-red-500"
                />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-gray-900">Manage Portfolio</h3>
              <p className="text-gray-600 max-w-xs">
                Track your positions and settle profits when events conclude.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-900">
            Ready to Start Trading?
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-gray-600">
            Join thousands of traders and start buying and selling sports outcomes today.
          </p>
          <Link 
            href="/auth/register" 
            className="rounded-md bg-blue-600 px-6 py-3 text-lg font-medium text-white hover:bg-blue-700"
          >
            Create Your Free Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-12 text-gray-800">
        <div className="container mx-auto px-4">
          <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-4">
            <div>
              <h3 className="mb-4 text-xl font-bold">BetWise</h3>
              <p className="text-gray-600">
                The next generation sports trading platform.
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Quick Links</h4>
              <ul className="space-y-2 text-gray-600">
                <li><Link href="/markets" className="hover:text-blue-600">Markets</Link></li>
                <li><Link href="/how-it-works" className="hover:text-blue-600">How It Works</Link></li>
                <li><Link href="/about" className="hover:text-blue-600">About Us</Link></li>
                <li><Link href="/contact" className="hover:text-blue-600">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Legal</h4>
              <ul className="space-y-2 text-gray-600">
                <li><Link href="/terms" className="hover:text-blue-600">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-blue-600">Privacy Policy</Link></li>
                <li><Link href="/responsible-trading" className="hover:text-blue-600">Responsible Trading</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Connect With Us</h4>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-600 hover:text-blue-600">
                  <span className="sr-only">Twitter</span>
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
                <a href="#" className="text-gray-600 hover:text-blue-600">
                  <span className="sr-only">LinkedIn</span>
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                </a>
                <a href="#" className="text-gray-600 hover:text-blue-600">
                  <span className="sr-only">Instagram</span>
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 3.992-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-3.992-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 text-center text-gray-600">
            <p>&copy; {new Date().getFullYear()} BetWise. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
