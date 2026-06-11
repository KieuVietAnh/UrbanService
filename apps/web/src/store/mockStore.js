// src/store/mockStore.js

const KEY_USERS = 'urbanmind_users';
const KEY_CATEGORIES = 'urbanmind_categories';
const KEY_OPERATORS = 'urbanmind_operators';
const KEY_TICKETS = 'urbanmind_tickets';
const KEY_COMMENTS = 'urbanmind_comments';
const KEY_NOTIFICATIONS = 'urbanmind_notifications';
const KEY_AI_CHAT = 'urbanmind_ai_chat';
const KEY_AUDIT_LOGS = 'urbanmind_audit_logs';
const KEY_SLA_CONFIG = 'urbanmind_sla_config';
const KEY_INTEGRATIONS = 'urbanmind_integrations';

// Initial pre-populated data
const defaultUsers = [
  {
    userId: 'u-101',
    fullName: 'Nguyễn Văn Hùng (Người Dân)',
    email: 'user@urbanmind.vn',
    passwordHash: '123456',
    phoneNumber: '0901234567',
    address: '123 Lê Lợi, Quận 1, TP. HCM',
    role: 'service-user',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80',
    isActive: true,
    createdAt: '2026-05-01T08:00:00Z'
  },
  {
    userId: 'u-102',
    fullName: 'Lê Thị Mai (Nhân Viên Tiếp Nhận)',
    email: 'staff@urbanmind.vn',
    passwordHash: '123456',
    phoneNumber: '0902345678',
    address: '456 Nguyễn Huệ, Quận 1, TP. HCM',
    role: 'system-staff',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80',
    isActive: true,
    createdAt: '2026-05-01T08:00:00Z'
  },
  {
    userId: 'u-103',
    fullName: 'Trần Minh Đức (Kỹ Thuật Viên Đô Thị)',
    email: 'operator@urbanmind.vn',
    passwordHash: '123456',
    phoneNumber: '0903456789',
    address: '789 Trần Hưng Đạo, Quận 5, TP. HCM',
    role: 'service-provider',
    operatorId: 1, // Public Lighting Maintenance Unit
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=100&q=80',
    isActive: true,
    createdAt: '2026-05-01T08:00:00Z'
  },
  {
    userId: 'u-104',
    fullName: 'Phạm Thanh Sơn (Quản Lý Tương Tác)',
    email: 'manager@urbanmind.vn',
    passwordHash: '123456',
    phoneNumber: '0904567890',
    address: '101 Võ Văn Tần, Quận 3, TP. HCM',
    role: 'interaction-manager',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80',
    isActive: true,
    createdAt: '2026-05-01T08:00:00Z'
  },
  {
    userId: 'u-105',
    fullName: 'Admin Hệ Thống',
    email: 'admin@urbanmind.vn',
    passwordHash: '123456',
    phoneNumber: '0905678901',
    address: '202 Lý Tự Trọng, Quận 1, TP. HCM',
    role: 'administrator',
    avatarUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=100&q=80',
    isActive: true,
    createdAt: '2026-05-01T08:00:00Z'
  }
];

const defaultCategories = [
  { categoryId: 1, categoryName: 'Vệ sinh & Rác thải', description: 'Báo cáo rác thải bừa bãi, cống rãnh ứ đọng rác, thu gom chậm', isActive: true, createdAt: '2026-05-01T00:00:00Z' },
  { categoryId: 2, categoryName: 'Điện chiếu sáng', description: 'Đèn đường hỏng, mất điện chiếu sáng khu phố, rò rỉ điện', isActive: true, createdAt: '2026-05-01T00:00:00Z' },
  { categoryId: 3, categoryName: 'Cấp thoát nước', description: 'Vỡ đường ống nước, ngập úng khi mưa, nắp hố ga hỏng', isActive: true, createdAt: '2026-05-01T00:00:00Z' },
  { categoryId: 4, categoryName: 'Giao thông & Đường sá', description: 'Ổ gà ổ voi hiểm họa, sụt lún vỉa hè, biển báo gãy hỏng', isActive: true, createdAt: '2026-05-01T00:00:00Z' },
  { categoryId: 5, categoryName: 'Cây xanh đô thị', description: 'Cây xanh gãy đổ đè đường dây, cành cây khô che khuất tầm nhìn', isActive: true, createdAt: '2026-05-01T00:00:00Z' }
];

const defaultOperators = [
  { operatorId: 1, categoryId: 2, operatorName: 'Công ty Cổ phần Chiếu sáng Đô thị TP. HCM', contactEmail: 'lighting@urbanservice.vn', contactPhone: '19001082', address: '12 Trương Định, Quận 3', isActive: true },
  { operatorId: 2, categoryId: 1, operatorName: 'Đơn vị Môi trường Đô thị Quận 1', contactEmail: 'waste.q1@urbanservice.vn', contactPhone: '02838221234', address: '88 Nguyễn Thái Học, Quận 1', isActive: true },
  { operatorId: 3, categoryId: 3, operatorName: 'Tổng Công ty Cấp nước Sài Gòn (SAWACO)', contactEmail: 'capnuoc@urbanservice.vn', contactPhone: '19001012', address: '1 Công trường Quốc tế, Quận 3', isActive: true },
  { operatorId: 4, categoryId: 4, operatorName: 'Khu Quản lý Giao thông Đô thị Số 1', contactEmail: 'roads1@urbanservice.vn', contactPhone: '02839101234', address: '286 Võ Thị Sáu, Quận 3', isActive: true },
  { operatorId: 5, categoryId: 5, operatorName: 'Công ty TNHH MTV Công viên Cây xanh TP. HCM', contactEmail: 'cayxanh@urbanservice.vn', contactPhone: '02839543210', address: '2 Công xã Paris, Quận 1', isActive: true }
];

const defaultSlaConfig = {
  Critical: { code: 'Critical', hours: 4, name: 'Khẩn cấp' },
  High: { code: 'High', hours: 12, name: 'Cao' },
  Medium: { code: 'Medium', hours: 24, name: 'Trung bình' },
  Low: { code: 'Low', hours: 72, name: 'Thấp' }
};

const defaultIntegrations = {
  zalo: { enabled: true, webhookUrl: 'https://webhook.zalo.me/urbanmind', status: 'Connected' },
  messenger: { enabled: true, webhookUrl: 'https://graph.facebook.com/v19.0/urbanmind', status: 'Connected' },
  hotline: { enabled: true, phone: '1900 8080', status: 'Operational' },
  webform: { enabled: true, status: 'Operational' }
};

const defaultTickets = [
  {
    feedbackId: 'fb-2026-001',
    userId: 'u-101',
    reporterName: 'Nguyễn Văn Hùng (Người Dân)',
    categoryId: 2, // Điện chiếu sáng
    title: 'Hỏng bóng đèn đường trước ngõ 123 Lê Lợi',
    description: 'Bóng đèn đường trước cửa số nhà 123 Lê Lợi bị nhấp nháy liên tục rồi tắt hẳn từ 3 ngày nay. Khu ngõ tối om gây mất an toàn giao thông và dễ xảy ra trộm cắp. Kính mong cơ quan chức năng kiểm tra thay thế.',
    locationText: '123 Lê Lợi, Bến Thành, Quận 1, TP. HCM',
    latitude: 10.7725,
    longitude: 106.6980,
    priority: 'Medium',
    status: 'Assigned',
    dueDate: '2026-06-04T12:00:00Z',
    isMasterTicket: false,
    parentTicketId: null,
    createdAt: '2026-06-02T12:00:00Z',
    updatedAt: '2026-06-03T09:00:00Z',
    attachments: ['https://images.unsplash.com/photo-1542382257-201b7f686e06?auto=format&fit=crop&w=400&q=80'],
    assignment: {
      operatorId: 1, // Công ty Chiếu sáng
      operatorName: 'Công ty Cổ phần Chiếu sáng Đô thị TP. HCM',
      assignedBy: 'u-102', // Staff
      assignedAt: '2026-06-03T09:00:00Z',
      status: 'Assigned',
      note: 'Điều phối đội kỹ thuật điện kiểm tra hỏng chấn lưu hoặc cháy bóng.'
    },
    sentiment: 'Negative',
    urgencyLevel: 'Medium',
    confidenceScore: 0.92,
    resolution: null,
    reviews: []
  },
  {
    feedbackId: 'fb-2026-002',
    userId: 'u-101',
    reporterName: 'Nguyễn Văn Hùng (Người Dân)',
    categoryId: 1, // Vệ sinh
    title: 'Đống rác tự phát lớn bốc mùi hôi thối ở góc phố Nguyễn Huệ',
    description: 'Một bãi rác tự phát lớn xuất hiện ở vỉa hè góc đường Nguyễn Huệ giao với Lê Lợi. Rác chất đống bao tải, xà bần bốc mùi hôi thối khó chịu giữa trung tâm thành phố. Mấy ngày nay không thấy công nhân dọn dẹp.',
    locationText: 'Góc Nguyễn Huệ - Lê Lợi, Quận 1, TP. HCM',
    latitude: 10.7742,
    longitude: 106.7018,
    priority: 'High',
    status: 'Submitted',
    dueDate: null,
    isMasterTicket: false,
    parentTicketId: null,
    createdAt: '2026-06-03T18:00:00Z',
    updatedAt: '2026-06-03T18:05:00Z',
    attachments: ['https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=400&q=80'],
    assignment: null,
    sentiment: 'Negative',
    urgencyLevel: 'High',
    confidenceScore: 0.95,
    resolution: null,
    reviews: []
  },
  {
    feedbackId: 'fb-2026-003',
    userId: 'u-101',
    reporterName: 'Nguyễn Văn Hùng',
    categoryId: 3, // Cấp thoát nước
    title: 'Mất nắp hố ga ngầm nguy hiểm ngã tư Võ Văn Kiệt',
    description: 'Nắp cống hố ga bị mất trộm tạo thành một cái hố sâu hoắm ngay trên làn xe máy hướng đi Quận 5. Người dân phải cắm cành cây tạm thời để cảnh báo. Trời mưa ngập nước sẽ cực kỳ nguy hiểm cho người đi đường.',
    locationText: 'Võ Văn Kiệt giao Nguyễn Thái Học, Quận 1, TP. HCM',
    latitude: 10.7681,
    longitude: 106.6995,
    priority: 'Critical',
    status: 'Resolved',
    dueDate: '2026-06-03T20:00:00Z',
    isMasterTicket: false,
    parentTicketId: null,
    createdAt: '2026-06-03T10:00:00Z',
    updatedAt: '2026-06-03T16:30:00Z',
    attachments: ['https://images.unsplash.com/photo-1599740831146-80e6eee75591?auto=format&fit=crop&w=400&q=80'],
    assignment: {
      operatorId: 3,
      operatorName: 'Tổng Công ty Cấp nước Sài Gòn (SAWACO)',
      assignedBy: 'u-102',
      assignedAt: '2026-06-03T11:00:00Z',
      status: 'Completed',
      note: 'Thay thế nắp đúc gang mới ngay lập tức.'
    },
    sentiment: 'Negative',
    urgencyLevel: 'Critical',
    confidenceScore: 0.98,
    resolution: {
      resolutionId: 1,
      operatorId: 3,
      resolvedBy: 'u-103',
      resolutionSummary: 'Thay mới nắp hố ga đúc gang chịu lực khóa an toàn',
      actionTaken: 'Đội kỹ thuật SAWACO đã di chuyển đến địa điểm, lắp đặt rào chắn, đo đạc kích thước hố ga và tiến hành lắp đặt nắp cống chịu lực gang đúc loại mới có chốt khóa chống trộm.',
      resultNote: 'Hố ga đã được sửa xong hoàn toàn, làn đường xe máy hoạt động bình thường, tuyệt đối an toàn.',
      resolvedAt: '2026-06-03T16:00:00Z',
      attachments: ['https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=400&q=80']
    },
    reviews: [] // Awaiting review!
  },
  {
    feedbackId: 'fb-2026-004',
    userId: 'u-101',
    reporterName: 'Nguyễn Văn Hùng',
    categoryId: 4, // Giao thông
    title: 'Ổ gà cực lớn sụt lún nguy hiểm trước ngã tư Hàm Nghi',
    description: 'Một hố sâu rộng hơn nửa mét sụt lún nghiêm trọng ngay vạch đi bộ qua đường trước cổng ga tàu điện ngầm Hàm Nghi. Đường nứt toác gây nguy hại cho các xe bus và xe máy qua lại.',
    locationText: 'Đối diện 50 Hàm Nghi, Bến Nghé, Quận 1',
    latitude: 10.7712,
    longitude: 106.7029,
    priority: 'High',
    status: 'Closed',
    dueDate: '2026-06-02T12:00:00Z',
    isMasterTicket: false,
    parentTicketId: null,
    createdAt: '2026-06-01T09:00:00Z',
    updatedAt: '2026-06-02T15:00:00Z',
    attachments: ['https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=400&q=80'],
    assignment: {
      operatorId: 4,
      operatorName: 'Khu Quản lý Giao thông Đô thị Số 1',
      assignedBy: 'u-102',
      assignedAt: '2026-06-01T10:00:00Z',
      status: 'Completed',
      note: 'Dậm vá thảm nhựa lại khu vực sụt lún vỉa hè đường.'
    },
    sentiment: 'Negative',
    urgencyLevel: 'High',
    confidenceScore: 0.91,
    resolution: {
      resolutionId: 2,
      operatorId: 4,
      resolvedBy: 'u-103',
      resolutionSummary: 'Đổ bê tông nhựa nóng bù lún hoàn trả mặt đường',
      actionTaken: 'Tiến hành đục bỏ bê tông hỏng, lu lèn đá base gia cố nền đất dưới sâu bị sụt lún và thảm nhựa nóng hoàn trả cốt đường ban đầu phẳng phiêu.',
      resultNote: 'Thi công hoàn tất trong đêm ngày 01/06. Mặt đường sạch sẽ và êm thuận.',
      resolvedAt: '2026-06-02T04:00:00Z',
      attachments: ['https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?auto=format&fit=crop&w=400&q=80']
    },
    reviews: [{
      reviewId: 1,
      userId: 'u-101',
      rating: 5,
      isSatisfied: true,
      comment: 'Xử lý cực nhanh, chất lượng nhựa đường bằng phẳng, công nhân dọn dẹp rác công trình sau khi làm sạch sẽ. Rất cảm ơn tổ liên ngành.',
      createdAt: '2026-06-02T15:00:00Z'
    }]
  },
  {
    feedbackId: 'fb-2026-005',
    userId: 'u-101',
    reporterName: 'Đặng Tuấn Anh (Người Dân)',
    categoryId: 1, // Vệ sinh & rác
    title: 'Rác tràn ngập tại khu phố đi bộ Bùi Viện sau đêm hội',
    description: 'Chai lọ nhựa, hộp xốp ăn uống vứt ngổn ngang tràn ngập dọc lề đường Bùi Viện. Các xe đẩy rác quá tải không có ai thu dọn dẹp gây ô uế cảnh quan khu du lịch đông người.',
    locationText: '180 Bùi Viện, Phạm Ngũ Lão, Quận 1',
    latitude: 10.7675,
    longitude: 106.6934,
    priority: 'Medium',
    status: 'Submitted',
    dueDate: null,
    isMasterTicket: false,
    parentTicketId: null,
    createdAt: '2026-06-03T19:30:00Z',
    updatedAt: '2026-06-03T19:30:00Z',
    attachments: ['https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=400&q=80'],
    assignment: null,
    sentiment: 'Negative',
    urgencyLevel: 'Medium',
    confidenceScore: 0.94,
    resolution: null,
    reviews: []
  }
];

const defaultComments = [
  {
    commentId: 1,
    feedbackId: 'fb-2026-001',
    userId: 'u-102', // Staff
    userName: 'Lê Thị Mai (Tiếp Nhận)',
    userRole: 'system-staff',
    content: 'Chào anh Hùng, ban tiếp nhận đã chuyển phản ánh điện chiếu sáng hỏng của anh đến Công ty Chiếu Sáng Đô Thị. Dự kiến kỹ thuật viên sẽ tiến hành sửa chữa thay thế trong hôm nay.',
    createdAt: '2026-06-03T09:05:00Z'
  },
  {
    commentId: 2,
    feedbackId: 'fb-2026-001',
    userId: 'u-101', // User
    userName: 'Nguyễn Văn Hùng (Người Dân)',
    userRole: 'service-user',
    content: 'Vâng cám ơn cán bộ tiếp nhận. Nhờ đội kỹ thuật kiểm tra cẩn thận vì đường dây điện chỗ này có vẻ hơi sà xuống thấp chạm cành cây nữa.',
    createdAt: '2026-06-03T09:12:00Z'
  }
];

const defaultNotifications = [
  {
    notificationId: 1,
    userId: 'u-101', // User
    title: 'Phản ánh đã được phân công xử lý',
    message: 'Phản ánh "Hỏng bóng đèn đường trước ngõ 123 Lê Lợi" của bạn đã được chuyển giao cho Đơn vị điện chiếu sáng đô thị xử lý.',
    type: 'StatusUpdate',
    isRead: false,
    targetUrl: '/tickets/fb-2026-001',
    createdAt: '2026-06-03T09:00:00Z'
  },
  {
    notificationId: 2,
    userId: 'u-101', // User
    title: 'Sự cố đã khắc phục xong - Đợi bạn đánh giá',
    message: 'Đơn vị Cấp thoát nước đã báo cáo hoàn thành sự cố hố ga ngã tư Võ Văn Kiệt. Mời bạn kiểm tra kết quả và đánh giá chất lượng.',
    type: 'ResolutionReview',
    isRead: false,
    targetUrl: '/tickets/fb-2026-003',
    createdAt: '2026-06-03T16:30:00Z'
  },
  {
    notificationId: 3,
    userId: 'u-103', // Operator
    title: 'Có công việc mới được phân công',
    message: 'Yêu cầu kiểm tra rò rỉ và cháy chấn lưu đèn ngõ 123 Lê Lợi đã được chuyển đến tài khoản của bạn.',
    type: 'Assignment',
    isRead: false,
    targetUrl: '/provider/tickets/fb-2026-001',
    createdAt: '2026-06-03T09:00:00Z'
  }
];

// Helper to initialize and retrieve state
export const mockDb = {
  init() {
    if (!localStorage.getItem(KEY_USERS)) {
      localStorage.setItem(KEY_USERS, JSON.stringify(defaultUsers));
      localStorage.setItem(KEY_CATEGORIES, JSON.stringify(defaultCategories));
      localStorage.setItem(KEY_OPERATORS, JSON.stringify(defaultOperators));
      localStorage.setItem(KEY_TICKETS, JSON.stringify(defaultTickets));
      localStorage.setItem(KEY_COMMENTS, JSON.stringify(defaultComments));
      localStorage.setItem(KEY_NOTIFICATIONS, JSON.stringify(defaultNotifications));
      localStorage.setItem(KEY_SLA_CONFIG, JSON.stringify(defaultSlaConfig));
      localStorage.setItem(KEY_INTEGRATIONS, JSON.stringify(defaultIntegrations));
      localStorage.setItem(KEY_AI_CHAT, JSON.stringify([]));
      localStorage.setItem(KEY_AUDIT_LOGS, JSON.stringify([
        { auditId: 1, userId: 'u-105', action: 'Initialize System', entityName: 'System', entityId: '0', createdAt: new Date().toISOString() }
      ]));
    }
  },

  // Generic Get & Set
  get(key) {
    this.init();
    return JSON.parse(localStorage.getItem(key));
  },
  set(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  // Domain accessors
  getUsers() { return this.get(KEY_USERS); },
  getCategories() { return this.get(KEY_CATEGORIES); },
  getOperators() { return this.get(KEY_OPERATORS); },
  getTickets() { return this.get(KEY_TICKETS); },
  getComments() { return this.get(KEY_COMMENTS); },
  getNotifications() { return this.get(KEY_NOTIFICATIONS); },
  getSlaConfig() { return this.get(KEY_SLA_CONFIG); },
  getIntegrations() { return this.get(KEY_INTEGRATIONS); },
  getAuditLogs() { return this.get(KEY_AUDIT_LOGS); },

  // Write changes
  updateTickets(tickets) { this.set(KEY_TICKETS, tickets); },
  updateNotifications(notifs) { this.set(KEY_NOTIFICATIONS, notifs); },
  updateComments(comments) { this.set(KEY_COMMENTS, comments); },
  updateCategories(cats) { this.set(KEY_CATEGORIES, cats); },
  updateUsers(users) { this.set(KEY_USERS, users); },
  updateSlaConfig(sla) { this.set(KEY_SLA_CONFIG, sla); },
  updateIntegrations(integrations) { this.set(KEY_INTEGRATIONS, integrations); },

  addAudit(userId, action, entityName, entityId, oldValues = null, newValues = null) {
    const logs = this.get(KEY_AUDIT_LOGS) || [];
    const newLog = {
      auditId: logs.length + 1,
      userId,
      action,
      entityName,
      entityId,
      oldValues: oldValues ? JSON.stringify(oldValues) : null,
      newValues: newValues ? JSON.stringify(newValues) : null,
      ipAddress: '127.0.0.1',
      userAgent: navigator.userAgent,
      createdAt: new Date().toISOString()
    };
    logs.unshift(newLog);
    this.set(KEY_AUDIT_LOGS, logs);
  },

  // Simulated AI Engine
  aiClassify(title, description) {
    const text = (title + ' ' + description).toLowerCase();
    let categoryId = 1; // Default to waste
    let sentiment = 'Negative';
    let urgencyLevel = 'Medium';
    let confidenceScore = 0.85;

    if (text.includes('đèn') || text.includes('chi chiếu sáng') || text.includes('tối')) {
      categoryId = 2; // Điện chiếu sáng
    } else if (text.includes('nước') || text.includes('hố ga') || text.includes('ngập') || text.includes('vỡ ống')) {
      categoryId = 3; // Cấp thoát nước
      urgencyLevel = text.includes('nguy hiểm') || text.includes('mất') ? 'Critical' : 'High';
    } else if (text.includes('đường') || text.includes('ổ gà') || text.includes('sụt lún') || text.includes('vỉa hè')) {
      categoryId = 4; // Giao thông
      urgencyLevel = 'High';
    } else if (text.includes('cây') || text.includes('đổ') || text.includes('cành')) {
      categoryId = 5; // Cây xanh
    }

    if (text.includes('gấp') || text.includes('nguy hiểm') || text.includes('tai nạn') || text.includes('chết người')) {
      urgencyLevel = 'Critical';
      confidenceScore = 0.95;
    }

    return {
      categoryId,
      sentiment,
      urgencyLevel,
      confidenceScore,
      summary: `Hệ thống ghi nhận thông tin sự cố liên quan đến nhóm [${defaultCategories.find(c => c.categoryId === categoryId).categoryName}] cần khắc phục gấp tại khu vực đường của cư dân báo.`
    };
  },

  checkDuplicates(categoryId, lat, lng) {
    const tickets = this.getTickets();
    // Return tickets of same category within roughly 500 meters (approx 0.005 degrees of lat/lng)
    return tickets.filter(t => 
      t.categoryId === categoryId &&
      t.status !== 'Closed' &&
      Math.abs(t.latitude - lat) < 0.005 &&
      Math.abs(t.longitude - lng) < 0.005
    );
  },

  // Interactive AI Law Chatbot
  getAiChatReply(messageText) {
    const text = messageText.toLowerCase();
    if (text.includes('rác') || text.includes('vứt rác')) {
      return 'Theo Nghị định 45/2022/NĐ-CP về xử phạt vi phạm hành chính trong lĩnh vực bảo vệ môi trường, hành vi vứt, thải rác thải sinh hoạt bừa bãi tại khu chung cư, thương mại, dịch vụ hoặc nơi công cộng có thể bị xử phạt từ 1.000.000đ đến 2.000.000đ. Vứt rác trên vỉa hè, lòng đường bị phạt từ 2.000.000đ đến 4.000.000đ. Bạn có muốn gửi một phản ánh rác thải đến chính quyền đô thị không?';
    } else if (text.includes('hố ga') || text.includes('nắp cống')) {
      return 'Việc bảo trì nắp cống hố ga thuộc trách nhiệm của đơn vị Công trình công cộng hoặc cấp thoát nước địa bàn (ví dụ SAWACO tại TP. HCM). Nếu phát hiện mất nắp hoặc hư hỏng nguy hiểm, đơn vị có nghĩa vụ lắp đặt rào chắn trong vòng 2 giờ và hoàn thành thay nắp mới trong vòng 12-24 giờ theo SLA khẩn cấp đô thị. Bạn có muốn tạo ngay phiếu phản ánh này?';
    } else if (text.includes('đèn đường') || text.includes('chiếu sáng')) {
      return 'Hệ thống chiếu sáng công cộng đô thị do Công ty Chiếu Sáng Đô Thị quản lý trực tiếp. Quy chuẩn kỹ thuật yêu cầu bóng cháy/hỏng đơn lẻ phải khắc phục trong vòng 24 giờ kể từ khi tiếp nhận. Sự cố mất điện nguyên khu phố cần xử lý khẩn cấp trong vòng 4 giờ. Hãy dùng tính năng Gửi phản ánh của UrbanMind để đội ngũ xử lý được định vị GPS chính xác nhất!';
    }
    return 'Xin chào! Tôi là Trợ lý AI UrbanMind. Tôi có thể hỗ trợ giải đáp nhanh các thông tin pháp lý đô thị, điều luật xử phạt bảo vệ môi trường, quy định giao thông đô thị hoặc hướng dẫn bạn gửi ý kiến phản ánh sự cố. Bạn có câu hỏi nào khác không?';
  }
};
