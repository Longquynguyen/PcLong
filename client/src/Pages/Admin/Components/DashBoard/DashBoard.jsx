import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Typography, Tag, Spin } from 'antd';
import { UserOutlined, ShoppingCartOutlined, DollarOutlined, EyeOutlined } from '@ant-design/icons';
import { Column } from '@ant-design/charts';
import styles from './DashBoard.module.scss';
import classNames from 'classnames/bind';
import { requestDashboard, requestGetOrderStats } from '../../../../config/request';

const { Title } = Typography;
const cx = classNames.bind(styles);

function DashBoard() {
    const [loading, setLoading] = useState(true);
    const [statistics, setStatistics] = useState({
        totalUsers: 0,
        totalProducts: 0,
        totalRevenue: 0,
        totalWatching: 0,
    });
    const [recentOrders, setRecentOrders] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [orderStats, setOrderStats] = useState([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const response = await requestDashboard();
                const {
                    statistics: statsData,
                    recentOrders: ordersData,
                    topProducts: productsData,
                } = response.metadata;

                setStatistics(statsData);
                setRecentOrders(
                    ordersData.map((order) => ({
                        key: order.id,
                        ...order,
                    })),
                );
                setTopProducts(
                    productsData.map((product) => ({
                        key: product.id,
                        ...product,
                    })),
                );
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        const fetchOrderStats = async () => {
            try {
                const response = await requestGetOrderStats();
                setOrderStats(response.metadata);
            } catch (error) {
                console.error('Error fetching order statistics:', error);
            }
        };

        fetchDashboardData();
        fetchOrderStats();
    }, []);

    const orderColumns = [
        {
            title: 'ID',
            dataIndex: 'idPayment',
            key: 'idPayment',
            width: 100,
        },
        {
            title: 'Khách hàng',
            dataIndex: 'fullName',
            key: 'fullName',
        },
        {
            title: 'Tổng tiền',
            dataIndex: 'totalPrice',
            key: 'totalPrice',
            render: (price) => `${price.toLocaleString('vi-VN')}đ`,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <Tag color={status === 'completed' ? 'green' : 'orange'}>
                    {status === 'completed' ? 'Hoàn thành' : 'Đang xử lý'}
                </Tag>
            ),
        },
        {
            title: 'Phương thức',
            dataIndex: 'typePayment',
            key: 'typePayment',
            render: (type) => {
                const colors = {
                    COD: 'blue',
                    Banking: 'green',
                    Momo: 'purple',
                };
                return <Tag color={colors[type]}>{type}</Tag>;
            },
        },
    ];

    const productColumns = [
        {
            title: 'Sản phẩm',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Danh mục',
            dataIndex: 'componentType',
            key: 'componentType',
            render: (type) => {
                const colors = {
                    pc: 'magenta',
                    vga: 'red',
                    cpu: 'blue',
                    ram: 'green',
                    ssd: 'orange',
                };
                return <Tag color={colors[type]}>{type.toUpperCase()}</Tag>;
            },
        },
        {
            title: 'Giá',
            dataIndex: 'price',
            key: 'price',
            render: (price) => `${price.toLocaleString('vi-VN')}đ`,
        },
        {
            title: 'Tồn kho',
            dataIndex: 'stock',
            key: 'stock',
            render: (stock) => <Tag color={stock > 10 ? 'green' : stock > 5 ? 'orange' : 'red'}>{stock}</Tag>,
        },
    ];

    // Chart configuration
    const config = {
        data: orderStats,
        xField: 'date',
        yField: 'count',
        color: '#1890ff',
        label: {
            position: 'middle',
            style: {
                fill: '#FFFFFF',
                opacity: 0.6,
            },
        },
        xAxis: {
            label: {
                autoHide: true,
                autoRotate: false,
            },
        },
        meta: {
            date: { alias: 'Ngày' },
            count: { alias: 'Số đơn hàng' },
        },
    };

    if (loading) {
        return (
            <div className={cx('loading-container')}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div className={cx('wrapper')}>
            <Title level={2}>Tổng quan</Title>

            {/* Thống kê */}
            <Row gutter={[16, 16]} className={cx('statistics')}>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic title="Tổng người dùng" value={statistics.totalUsers} prefix={<UserOutlined />} />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Tổng sản phẩm"
                            value={statistics.totalProducts}
                            prefix={<ShoppingCartOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Doanh thu"
                            value={statistics.totalRevenue}
                            prefix={<DollarOutlined />}
                            suffix="đ"
                            formatter={(value) => `${value.toLocaleString('vi-VN')}`}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Sản phẩm được theo dõi"
                            value={statistics.totalWatching}
                            prefix={<EyeOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Biểu đồ đơn hàng 7 ngày gần đây */}
            <Row gutter={[16, 16]} className={cx('order-chart')}>
                <Col xs={24}>
                    <Card title="Đơn hàng trong 7 ngày gần đây">
                        <Column {...config} />
                    </Card>
                </Col>
            </Row>

            {/* Bảng dữ liệu */}
            <Row gutter={[16, 16]} className={cx('data-tables')}>
                <Col xs={24} lg={12}>
                    <Card title="Đơn hàng gần đây">
                        <Table
                            columns={orderColumns}
                            dataSource={recentOrders}
                            pagination={{ pageSize: 5 }}
                            scroll={{ x: true }}
                        />
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card title="Sản phẩm bán chạy">
                        <Table
                            columns={productColumns}
                            dataSource={topProducts}
                            pagination={{ pageSize: 5 }}
                            scroll={{ x: true }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
}

export default DashBoard;
