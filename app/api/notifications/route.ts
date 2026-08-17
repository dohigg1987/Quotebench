import { getCurrentUser } from "../../auth";
import { listNotifications, markNotificationsRead } from "../../../db/notification-store";
import { requireWorkspaceContext } from "../../../db/workspace-store";

export const dynamic="force-dynamic";

export async function GET(){const user=await getCurrentUser();if(!user)return Response.json({error:"unauthorised"},{status:401});const workspace=await requireWorkspaceContext(user,["owner","admin","quoter"]);const notifications=await listNotifications(workspace.tenantId,user.email);return Response.json({notifications,unreadCount:notifications.filter(item=>!item.readAt).length});}

export async function POST(request:Request){const user=await getCurrentUser();if(!user)return Response.json({error:"unauthorised"},{status:401});const workspace=await requireWorkspaceContext(user,["owner","admin","quoter"]);const body=await request.json() as {eventIds?:unknown};if(!Array.isArray(body.eventIds))return Response.json({error:"eventIds must be an array"},{status:400});await markNotificationsRead(workspace.tenantId,user.email,body.eventIds.map(String));const notifications=await listNotifications(workspace.tenantId,user.email);return Response.json({notifications,unreadCount:notifications.filter(item=>!item.readAt).length});}

