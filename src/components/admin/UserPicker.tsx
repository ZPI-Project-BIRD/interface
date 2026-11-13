import { useState } from "react";
import { Button, Select } from "antd";
import { useInfiniteQuery } from "react-query";
import { api } from "../../api";
import { privateQueryKey } from "../../queryClient";
import { useAuthStore } from "../../stores/authStore";
import { isAdministrator } from "../../permissions/organizationCapabilities";

export function UserPicker({ value, onChange, disabled, excludeIds = [] }: {
  value?: string; onChange?: (value: string) => void; disabled?: boolean; excludeIds?: string[];
}) {
  const [search, setSearch] = useState("");
  const sessionId = useAuthStore((state) => state.sessionId);
  const user = useAuthStore((state) => state.user);
  const users = useInfiniteQuery(privateQueryKey(sessionId, "user-picker", search),
    ({ pageParam = 0, signal }) => api.users.search({ search, limit: 50, offset: pageParam }, { signal }),
    { enabled: isAdministrator(user) && !disabled, getNextPageParam: (last, pages) => last.length === 50 ? pages.length * 50 : undefined });
  return <Select showSearch filterOption={false} value={value} onChange={onChange} disabled={disabled}
    onSearch={setSearch} loading={users.isFetching} placeholder="Search by name or username"
    options={users.data?.pages.flat().filter((user) => !excludeIds.includes(user.id)).map((user) => ({
      value: user.id, label: `${user.friendlyName} (@${user.username})${user.bannedAt ? " · Banned" : ""}`,
    }))}
    notFoundContent={users.isError ? <Button onClick={() => void users.refetch()}>Could not load users · Retry</Button> : undefined}
    popupRender={(menu) => <>{menu}{users.hasNextPage && <Button block loading={users.isFetchingNextPage}
      onMouseDown={(event) => event.preventDefault()} onClick={() => void users.fetchNextPage()}>Load more users</Button>}</>}
  />;
}
