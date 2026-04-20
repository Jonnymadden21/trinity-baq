import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import MachineSelector from "@/pages/machine-selector";
import Configurator from "@/pages/configurator";
import QuoteSummary from "@/pages/quote-summary";
import QuotePreview from "@/pages/quote-preview";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/" component={MachineSelector} />
        <Route path="/configure/:slug" component={Configurator} />
        <Route path="/quote/:quoteNumber" component={QuoteSummary} />
        <Route path="/preview" component={QuotePreview} />
        <Route path="/preview/:machine" component={QuotePreview} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AppRouter />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
