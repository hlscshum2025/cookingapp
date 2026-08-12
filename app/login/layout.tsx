import { PasswordPressReveal } from "@/components/PasswordPressReveal";

export default function LoginLayout({children}:{children:React.ReactNode}){
  return <>{children}<PasswordPressReveal/></>;
}
