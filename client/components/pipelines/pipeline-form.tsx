"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CSVUpload } from "@/components/shared/csv-upload";
import { DataPreview } from "@/components/shared/data-preview";
import type { ParsedCSV } from "@/lib/types";

// Pre-built prompt templates showcasing advanced capabilities
const PROMPT_TEMPLATES = [
  {
    id: "dedup-merge",
    title: "Smart Deduplication",
    description: "Merge duplicate records intelligently",
    prompt: `Identify and merge duplicate customer records based on email similarity (accounting for typos like gmail vs gmial). For merged records, keep the most recent entry's data but preserve the earliest created_at date. Normalize all email addresses to lowercase, remove any rows where email is empty or invalid, and output columns: email, full_name, company, first_seen_date, last_activity_date.`,
  },
  {
    id: "lead-scoring",
    title: "Lead Qualification",
    description: "Score and segment sales leads",
    prompt: `Analyze and score leads based on engagement signals. Create a lead_score (0-100) using these weighted criteria: has company email domain (+30), title contains Director/VP/C-level (+25), company size > 100 employees (+20), opened emails in last 30 days (+15), visited pricing page (+10). Segment into tiers: hot (score >= 70), warm (40-69), cold (< 40). Filter out personal email domains (gmail, yahoo, hotmail). Output: email, name, company, title, lead_score, segment, and sort by score descending.`,
  },
  {
    id: "data-enrichment",
    title: "Data Standardization",
    description: "Clean and enrich messy data",
    prompt: `Standardize this messy dataset: normalize phone numbers to E.164 format (+1XXXXXXXXXX), parse and standardize addresses into separate columns (street, city, state, zip), fix inconsistent date formats to YYYY-MM-DD, normalize company names (remove Inc/LLC/Ltd suffixes, fix common misspellings), validate email formats and flag invalid ones. Remove completely empty rows and deduplicate based on the normalized email.`,
  },
  {
    id: "cohort-analysis",
    title: "Cohort Segmentation",
    description: "Group users into behavioral cohorts",
    prompt: `Segment users into behavioral cohorts for analysis. Create cohort labels based on: signup_month (YYYY-MM format), acquisition_channel, and engagement_level (power_user if actions > 50, active if 10-50, casual if 1-9, dormant if 0). Calculate days_since_signup and days_since_last_active for each user. Filter to only users who signed up in the last 12 months. Output should include user_id, email, cohort_month, acquisition_channel, engagement_level, total_actions, days_active, and lifetime_value if available.`,
  },
  {
    id: "anomaly-detection",
    title: "Outlier Detection",
    description: "Find anomalies in transaction data",
    prompt: `Identify potentially fraudulent or anomalous transactions. Flag transactions where: amount is more than 3 standard deviations from the user's average, transaction occurred outside user's typical hours (based on their history), location is significantly different from previous transactions, or multiple transactions occurred within 5 minutes. Add columns: is_anomaly (boolean), anomaly_reasons (comma-separated list), risk_score (0-100). Sort by risk_score descending and filter to only show flagged transactions.`,
  },
  {
    id: "funnel-analysis",
    title: "Conversion Funnel",
    description: "Track progression through stages",
    prompt: `Build a conversion funnel analysis from event data. Track users through stages: awareness (visited site) -> interest (viewed product) -> consideration (added to cart) -> intent (started checkout) -> purchase (completed order). For each user, identify their furthest stage reached, time spent in each stage, and drop-off point if they didn't convert. Calculate conversion rates between each stage. Output user-level data with: user_id, email, furthest_stage, converted (boolean), days_to_convert, drop_off_stage, and total_revenue if purchased.`,
  },
];


interface PipelineFormProps {
  onSubmit: (data: { prompt: string; csvContent: string; parsedData: ParsedCSV }) => void;
  isSubmitting?: boolean;
}

export function PipelineForm({ onSubmit, isSubmitting }: PipelineFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [parsedData, setParsedData] = useState<ParsedCSV | null>(null);
  const [rawContent, setRawContent] = useState<string>("");
  const [prompt, setPrompt] = useState("");

  const handleDataParsed = (data: ParsedCSV, content: string) => {
    setParsedData(data);
    setRawContent(content);
  };

  const handleSubmit = () => {
    if (!parsedData || !prompt.trim()) return;
    onSubmit({
      prompt: prompt.trim(),
      csvContent: rawContent,
      parsedData,
    });
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center gap-4">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
          step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}>
          1
        </div>
        <div className={`h-0.5 w-16 ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
          step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}>
          2
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Your Data</CardTitle>
            <CardDescription>
              Upload a CSV file or paste your data directly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <CSVUpload onDataParsed={handleDataParsed} />
            
            {parsedData && (
              <>
                <DataPreview data={parsedData} maxRows={5} />
                <div className="flex justify-end">
                  <Button onClick={() => setStep(2)}>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Describe Your Goal</CardTitle>
            <CardDescription>
              Tell us what you want to do with your data in plain English
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {parsedData && (
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="mb-2 text-sm font-medium">Your data:</p>
                <p className="text-sm text-muted-foreground">
                  {parsedData.headers.length} columns ({parsedData.headers.slice(0, 5).join(", ")}
                  {parsedData.headers.length > 5 && "..."}) &middot; {parsedData.rows.length} rows
                </p>
              </div>
            )}

            {/* Prompt Templates */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <p className="text-sm font-medium">Quick Start Templates</p>
                <span className="text-xs text-muted-foreground">Click to use</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {PROMPT_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setPrompt(template.prompt)}
                    className={`group relative rounded-lg border p-3 text-left transition-all hover:border-primary hover:bg-primary/5 ${
                      prompt === template.prompt ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <p className="font-medium text-sm">{template.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {template.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Textarea
                placeholder="Describe your data transformation in detail. Be specific about columns, filtering criteria, deduplication logic, and output format."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[150px]"
              />
              <p className="text-xs text-muted-foreground">
                Unlike chat-based AI, this creates a deterministic, reusable pipeline you can run on any dataset.
              </p>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!prompt.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Build Pipeline
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
