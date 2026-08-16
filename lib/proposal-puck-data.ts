import type { Data } from "@puckeditor/core";
import type { BlockType, DocumentBlock, DocumentPage } from "../db/document-store";

const blockTypes: readonly BlockType[] = ["heading", "text", "callout", "pricing_table", "options", "image", "video", "testimonial", "feature_grid", "timeline", "team", "faq", "terms", "signature", "spacer"];
const governedTypes = new Set<BlockType>(["pricing_table", "terms", "signature"]);

export function proposalPageToPuckData(page: DocumentPage): Data {
  return {
    root: { props: { format: page.format, background: page.background } },
    content: page.blocks.map((block) => {
      const { type, ...props } = block;
      return { type, props };
    }),
  } as Data;
}

function asString(value: unknown, limit: number) {
  return typeof value === "string" ? value.slice(0, limit) : undefined;
}

export function puckDataToProposalBlocks(data: Data): DocumentBlock[] {
  return data.content.slice(0, 60).flatMap((entry) => {
    const type = entry.type as BlockType;
    if (!blockTypes.includes(type)) return [];
    const props = entry.props as Record<string, unknown>;
    const block: DocumentBlock = {
      id: typeof props.id === "string" ? props.id : crypto.randomUUID(),
      type,
      enabled: props.enabled !== false,
      locked: governedTypes.has(type) || props.locked === true,
    };
    const title = asString(props.title, 160);
    const eyebrow = asString(props.eyebrow, 80);
    const content = asString(props.content, 12000);
    const fileId = asString(props.fileId, 200);
    const mediaUrl = asString(props.mediaUrl, 2000);
    if (title !== undefined) block.title = title;
    if (eyebrow !== undefined) block.eyebrow = eyebrow;
    if (content !== undefined) block.content = content;
    if (fileId !== undefined) block.fileId = fileId;
    if (mediaUrl !== undefined) block.mediaUrl = mediaUrl;
    if (["full", "split", "cards", "compact"].includes(String(props.layout))) block.layout = props.layout as DocumentBlock["layout"];
    if (["left", "center"].includes(String(props.alignment))) block.alignment = props.alignment as DocumentBlock["alignment"];
    if (["totals", "lines", "full"].includes(String(props.display))) block.display = props.display as DocumentBlock["display"];
    if ([1, 2, 3, 4].includes(Number(props.columns))) block.columns = Number(props.columns) as DocumentBlock["columns"];
    if (Array.isArray(props.items)) {
      block.items = props.items.slice(0, 24).map((value) => {
        const item = value as Record<string, unknown>;
        return {
          id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
          title: asString(item.title, 160) ?? "",
          content: asString(item.content, 2000) ?? "",
        };
      });
    }
    return [block];
  });
}

export { governedTypes };
