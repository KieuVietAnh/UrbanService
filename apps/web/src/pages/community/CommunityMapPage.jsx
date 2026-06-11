// src/pages/community/CommunityMapPage.jsx
import { mockDb } from '../../store/mockStore';
import { LocationPicker } from '../../components/maps/LocationPicker';

export const CommunityMapPage = () => {
  const tickets = mockDb.getTickets().filter((ticket) => ticket.latitude && ticket.longitude);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-black">Bản Đồ Phản Ánh Cộng Đồng</h2>
        <p className="text-xs text-gray-500 font-semibold">Bản đồ vị trí định vị sự cố đô thị trực tuyến. Rà soát, theo dõi mật độ phân bố các vấn đề đô thị theo khu vực dân cư.</p>
      </div>

      {/* Map card wrapper */}
      <div className="card bg-base-100 border border-base-300 p-4 rounded-3xl shadow-sm">
        <LocationPicker
          readonly
          initialLatitude={10.776530}
          initialLongitude={106.700981}
          markers={tickets}
        />
      </div>
    </div>
  );
};
