"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFollow } from "@/app/actions/student";

interface Props {
  teacherId: string;
  teacherSlug: string;
  isFollowing: boolean;
  isAuthed: boolean;
}

export default function FollowButton({
  teacherId,
  teacherSlug,
  isFollowing,
  isAuthed,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!isAuthed) {
    return (
      <button
        type="button"
        className="btn btn-outline"
        onClick={() =>
          router.push(`/login?next=${encodeURIComponent(`/teacher/${teacherSlug}`)}`)
        }
      >
        ＋ تابع هذا المعلم
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`btn ${isFollowing ? "btn-following" : "btn-outline"}`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleFollow(teacherId, teacherSlug, isFollowing);
          router.refresh();
        })
      }
    >
      {pending ? "…" : isFollowing ? "✓ تتابعه" : "＋ تابع هذا المعلم"}
    </button>
  );
}
