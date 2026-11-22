import { FinanceReport } from "@/components/dashboard/finance-register";
import { Button } from "@/components/ui/button";
export default function Page() {
  return <><Button href="/staff/finance/collections" variant="outline" className="mb-5">Payment collections</Button><FinanceReport /></>;
}
