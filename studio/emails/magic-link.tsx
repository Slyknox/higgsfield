import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"

export interface MagicLinkEmailProps {
  url: string
  brand: string
  /** Minutes until the link expires. */
  expiresInMinutes: number
}

const LIME = "#d1fe17"

/** The sign-in email. Plain, dark, one big button, with a copyable fallback link. */
export function MagicLinkEmail({ url, brand, expiresInMinutes }: MagicLinkEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`Your ${brand} sign-in link`}</Preview>
      <Body style={{ backgroundColor: "#131416", fontFamily: "Inter, Helvetica, Arial, sans-serif", margin: 0, padding: "32px 0" }}>
        <Container style={{ maxWidth: 480, margin: "0 auto", padding: "32px", backgroundColor: "#1a1b1e", borderRadius: 16 }}>
          <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: 700, margin: 0 }}>{brand}</Text>
          <Heading as="h1" style={{ color: "#ffffff", fontSize: 24, lineHeight: "32px", margin: "24px 0 8px" }}>
            Sign in to {brand}
          </Heading>
          <Text style={{ color: "#a1a1aa", fontSize: 14, lineHeight: "22px", margin: "0 0 24px" }}>
            Click the button to sign in. The link works once and expires in {expiresInMinutes} minutes.
          </Text>
          <Section>
            <Button
              href={url}
              style={{
                backgroundColor: LIME,
                color: "#111111",
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 12,
                padding: "14px 24px",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Sign in to {brand}
            </Button>
          </Section>
          <Text style={{ color: "#a1a1aa", fontSize: 12, lineHeight: "20px", margin: "24px 0 0" }}>
            Or paste this link into your browser:
            <br />
            <Link href={url} style={{ color: "#e4e4e7", wordBreak: "break-all" }}>
              {url}
            </Link>
          </Text>
          <Text style={{ color: "#71717a", fontSize: 12, lineHeight: "20px", margin: "24px 0 0" }}>
            If you didn&apos;t ask to sign in, you can ignore this email. Nobody can sign in without this link.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export function magicLinkText({ url, brand, expiresInMinutes }: MagicLinkEmailProps): string {
  return [
    `Sign in to ${brand}`,
    "",
    `Open this link to sign in. It works once and expires in ${expiresInMinutes} minutes:`,
    url,
    "",
    "If you didn't ask to sign in, you can ignore this email.",
  ].join("\n")
}
