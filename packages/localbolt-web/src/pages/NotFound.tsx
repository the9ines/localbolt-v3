
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Helmet } from "react-helmet";

const NotFound = () => {
  return (
    <>
      <Helmet>
        <title>Page Not Found | LocalBolt</title>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2314FF6A'><path d='M13 10V3L4 14h7v7l9-11h-7z'/></svg>" />
      </Helmet>
      <div className="min-h-screen bg-dark flex flex-col items-center justify-center text-white p-4">
        <div className="text-center space-y-6 max-w-md">
          <h1 className="text-4xl font-bold text-neon">404 - Page Not Found</h1>
          <p className="text-gray-400">The page you're looking for doesn't exist or has been moved.</p>
          <Button asChild className="bg-neon text-black hover:bg-neon/90">
            <Link to="/">Return to Home</Link>
          </Button>
        </div>
      </div>
    </>
  );
};

export default NotFound;
