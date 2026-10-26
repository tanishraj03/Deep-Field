import { ArrowBigUp, Eye, MessageSquare } from "lucide-react";
import type { Post } from "@/lib/types";
import { relativeTime } from "@/lib/utils";
import { Flag, Metric, SOURCE_META } from "./ui";

/** One conversation, linked to where it lives. Every number is the platform's. */
export function PostRow({ post }: { post: Post }) {
  const m = SOURCE_META[post.source];
  return (
    <a href={post.url} target="_blank" rel="noreferrer" className="group -mx-2 flex gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-hair/[0.04]">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.color }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[0.875rem] font-medium leading-snug group-hover:text-accent">{post.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
          <span className="flex items-center gap-1.5"><Flag region={post.region} />{post.community}</span>
          <span>{relativeTime(post.createdAt)}</span>
          <Metric icon={MessageSquare} value={post.comments} label="comments" />
          <Metric icon={ArrowBigUp} value={post.score} label={post.source === "youtube" ? "likes" : "upvotes"} />
          <Metric icon={Eye} value={post.views} label="views" />
          {!post.measured && post.source === "reddit" && <span className="text-faint">counts settle after ~36h</span>}
        </div>
      </div>
    </a>
  );
}
