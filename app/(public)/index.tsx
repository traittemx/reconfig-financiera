import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Linking,
  Platform,
  Dimensions,
} from 'react-native';
import { Link } from 'expo-router';
import {
  GraduationCap,
  Wallet,
  TrendingUp,
  Users,
  Brain,
  Target,
  PiggyBank,
  BarChart3,
  Shield,
  Heart,
  Clock,
  CheckCircle2,
  ArrowRight,
  MessageCircle,
  Building2,
  Briefcase,
  Sparkles,
} from '@tamagui/lucide-icons';

const { width } = Dimensions.get('window');
const isSmallScreen = width < 768;

// Brand colors
const COLORS = {
  primary: '#152D5F',
  primaryLight: '#1E3A7D',
  primaryDark: '#0F1F42',
  accent: '#25B573',
  accentLight: '#2ECC85',
  accentDark: '#1E9960',
  white: '#FFFFFF',
  background: '#F8FAFC',
  lightGray: '#E2E8F0',
  gray: '#64748B',
  darkGray: '#334155',
  text: '#1E293B',
};

export default function LandingScreen() {
  // No redirect logic here - let the layout handle authentication redirects
  // This ensures the landing page always shows for unauthenticated users

  const handleWhatsAppPress = () => {
    Linking.openURL('https://w.app/yrpyco');
  };

  const curriculumDays = [
    { day: '1-3', title: 'Tu relación con el dinero', description: 'Descubre tus creencias y patrones financieros' },
    { day: '4-6', title: 'Diagnóstico financiero', description: 'Evalúa tu situación actual con claridad' },
    { day: '7-9', title: 'Presupuesto personal', description: 'Crea un plan de gastos efectivo' },
    { day: '10-12', title: 'Control de gastos', description: 'Técnicas para registrar y optimizar' },
    { day: '13-15', title: 'Ahorro inteligente', description: 'Estrategias para construir tu fondo de emergencia' },
    { day: '16-18', title: 'Deudas y créditos', description: 'Maneja y elimina deudas de forma estratégica' },
    { day: '19-21', title: 'Metas financieras', description: 'Define y planifica tus objetivos' },
    { day: '22-23', title: 'Hábitos sostenibles', description: 'Consolida tu nuevo estilo de vida financiero' },
  ];

  const features = [
    {
      icon: <Wallet size={32} color={COLORS.accent} />,
      title: 'Registro de Gastos',
      description: 'Registra cada gasto de forma rápida y sencilla. Categoriza automáticamente y visualiza a dónde va tu dinero.',
    },
    {
      icon: <BarChart3 size={32} color={COLORS.accent} />,
      title: 'Presupuestos Personalizados',
      description: 'Crea presupuestos mensuales por categoría. Recibe alertas cuando te acerques a tus límites.',
    },
    {
      icon: <TrendingUp size={32} color={COLORS.accent} />,
      title: 'Reportes y Análisis',
      description: 'Gráficas claras de tu comportamiento financiero. Identifica patrones y oportunidades de mejora.',
    },
    {
      icon: <Target size={32} color={COLORS.accent} />,
      title: 'Metas de Ahorro',
      description: 'Define metas específicas y visualiza tu progreso. Celebra cada logro en el camino.',
    },
  ];

  const benefits = [
    {
      icon: <Brain size={28} color={COLORS.white} />,
      title: 'Menos estrés financiero',
      description: 'Empleados con finanzas sanas tienen 50% menos estrés laboral',
    },
    {
      icon: <TrendingUp size={28} color={COLORS.white} />,
      title: 'Mayor productividad',
      description: 'Hasta 3 horas semanales recuperadas al eliminar preocupaciones económicas',
    },
    {
      icon: <Heart size={28} color={COLORS.white} />,
      title: 'Mejor bienestar',
      description: 'Mejora la salud mental y física de tu equipo',
    },
    {
      icon: <Users size={28} color={COLORS.white} />,
      title: 'Retención de talento',
      description: 'Los empleados valoran empresas que invierten en su bienestar integral',
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.heroContent}>
          <Image
            source={require('@/assets/images/finaria-logo-full.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.heroTitle}>
            Transforma las finanzas personales{'\n'}de tu equipo
          </Text>
          <Text style={styles.heroSubtitle}>
            Plataforma integral de educación financiera para empresas.{'\n'}
            Curso de 23 días + herramientas de gestión de gastos y presupuestos.
          </Text>
          <View style={styles.heroButtons}>
            <Pressable style={styles.primaryButton} onPress={handleWhatsAppPress}>
              <MessageCircle size={20} color={COLORS.white} />
              <Text style={styles.primaryButtonText}>Afiliar mi empresa</Text>
            </Pressable>
            <Link href="/(public)/signup" asChild>
              <Pressable style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Ya tengo código de empresa</Text>
                <ArrowRight size={18} color={COLORS.primary} />
              </Pressable>
            </Link>
          </View>
        </View>
        <View style={styles.heroDecoration}>
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
        </View>
      </View>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>23</Text>
          <Text style={styles.statLabel}>Días de curso</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>8</Text>
          <Text style={styles.statLabel}>Módulos prácticos</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>100%</Text>
          <Text style={styles.statLabel}>En tu celular</Text>
        </View>
      </View>

      {/* Course Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.iconBadge}>
            <GraduationCap size={24} color={COLORS.accent} />
          </View>
          <Text style={styles.sectionTitle}>Curso de 23 días</Text>
          <Text style={styles.sectionSubtitle}>
            Un viaje de transformación para comprender tu relación con el dinero
            y crear hábitos financieros saludables
          </Text>
        </View>
        <View style={styles.curriculumGrid}>
          {curriculumDays.map((item, index) => (
            <View key={index} style={styles.curriculumCard}>
              <View style={styles.dayBadge}>
                <Text style={styles.dayBadgeText}>Días {item.day}</Text>
              </View>
              <Text style={styles.curriculumTitle}>{item.title}</Text>
              <Text style={styles.curriculumDesc}>{item.description}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Features Section */}
      <View style={[styles.section, styles.sectionAlt]}>
        <View style={styles.sectionHeader}>
          <View style={styles.iconBadge}>
            <Sparkles size={24} color={COLORS.accent} />
          </View>
          <Text style={styles.sectionTitle}>Herramientas incluidas</Text>
          <Text style={styles.sectionSubtitle}>
            Más que un curso: una plataforma completa para gestionar tu dinero día a día
          </Text>
        </View>
        <View style={styles.featuresGrid}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureCard}>
              <View style={styles.featureIconWrap}>{feature.icon}</View>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDesc}>{feature.description}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Benefits Section */}
      <View style={styles.benefitsSection}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: COLORS.white }]}>
            ¿Por qué invertir en finanzas personales?
          </Text>
          <Text style={[styles.sectionSubtitle, { color: 'rgba(255,255,255,0.85)' }]}>
            Los problemas financieros afectan directamente el rendimiento laboral.
            Finaria ayuda a crear equipos más enfocados y comprometidos.
          </Text>
        </View>
        <View style={styles.benefitsGrid}>
          {benefits.map((benefit, index) => (
            <View key={index} style={styles.benefitCard}>
              <View style={styles.benefitIcon}>{benefit.icon}</View>
              <Text style={styles.benefitTitle}>{benefit.title}</Text>
              <Text style={styles.benefitDesc}>{benefit.description}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* For Advisors Section */}
      <View style={styles.section}>
        <View style={styles.advisorsCard}>
          <View style={styles.advisorsContent}>
            <View style={styles.advisorsIconRow}>
              <View style={styles.advisorIcon}>
                <Shield size={28} color={COLORS.accent} />
              </View>
              <View style={styles.advisorIcon}>
                <Briefcase size={28} color={COLORS.accent} />
              </View>
            </View>
            <Text style={styles.advisorsTitle}>
              Para Asesores de Seguros y Financieros
            </Text>
            <Text style={styles.advisorsDesc}>
              Finaria es la herramienta perfecta para complementar tu servicio.
              Ayuda a tus clientes a ordenar sus finanzas antes de invertir o contratar
              un seguro. Clientes con finanzas sanas toman mejores decisiones y
              permanecen más tiempo contigo.
            </Text>
            <View style={styles.advisorsBenefits}>
              <View style={styles.advisorBenefitItem}>
                <CheckCircle2 size={18} color={COLORS.accent} />
                <Text style={styles.advisorBenefitText}>
                  Agrega valor diferenciado a tu servicio
                </Text>
              </View>
              <View style={styles.advisorBenefitItem}>
                <CheckCircle2 size={18} color={COLORS.accent} />
                <Text style={styles.advisorBenefitText}>
                  Clientes mejor preparados para ahorrar e invertir
                </Text>
              </View>
              <View style={styles.advisorBenefitItem}>
                <CheckCircle2 size={18} color={COLORS.accent} />
                <Text style={styles.advisorBenefitText}>
                  Fortalece la relación a largo plazo
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* CTA Section */}
      <View style={styles.ctaSection}>
        <View style={styles.ctaCard}>
          <Building2 size={40} color={COLORS.accent} />
          <Text style={styles.ctaTitle}>
            ¿Listo para transformar las finanzas de tu equipo?
          </Text>
          <Text style={styles.ctaDesc}>
            Contáctanos para conocer planes empresariales y comenzar
            a ofrecer bienestar financiero a tus colaboradores.
          </Text>
          <Pressable style={styles.ctaButton} onPress={handleWhatsAppPress}>
            <MessageCircle size={22} color={COLORS.white} />
            <Text style={styles.ctaButtonText}>Contactar por WhatsApp</Text>
          </Pressable>
        </View>
      </View>

      {/* Employee Access Section */}
      <View style={styles.employeeSection}>
        <Text style={styles.employeeTitle}>¿Tu empresa ya está afiliada?</Text>
        <Text style={styles.employeeDesc}>
          Si tu organización ya tiene acceso a Finaria, crea tu cuenta con el código
          de vinculación que te proporcionaron.
        </Text>
        <View style={styles.employeeButtons}>
          <Link href="/(public)/signup" asChild>
            <Pressable style={styles.employeeButton}>
              <Users size={20} color={COLORS.white} />
              <Text style={styles.employeeButtonText}>Crear mi cuenta</Text>
            </Pressable>
          </Link>
          <Link href="/(public)/auth" asChild>
            <Pressable style={styles.loginButton}>
              <Text style={styles.loginButtonText}>Ya tengo cuenta</Text>
              <ArrowRight size={18} color={COLORS.primary} />
            </Pressable>
          </Link>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Image
          source={require('@/assets/images/finaria-logo-full.png')}
          style={styles.footerLogo}
          resizeMode="contain"
        />
        <Text style={styles.footerText}>
          Educación financiera para un mejor bienestar
        </Text>
        <Text style={styles.copyright}>© 2026 Finaria. Todos los derechos reservados.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Hero Section
  heroSection: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 60 : 80,
    paddingBottom: 80,
    position: 'relative',
    overflow: 'hidden',
  },
  heroContent: {
    alignItems: 'center',
    zIndex: 10,
  },
  logo: {
    width: 200,
    height: 60,
    marginBottom: 32,
  },
  heroTitle: {
    fontSize: isSmallScreen ? 28 : 40,
    fontWeight: '800',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: isSmallScreen ? 36 : 52,
  },
  heroSubtitle: {
    fontSize: isSmallScreen ? 16 : 18,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 26,
    maxWidth: 600,
  },
  heroButtons: {
    flexDirection: isSmallScreen ? 'column' : 'row',
    gap: 16,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
    shadowColor: COLORS.accentDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  heroDecoration: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  decorCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(37, 181, 115, 0.15)',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -50,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },

  // Stats Section
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: 24,
    marginTop: -40,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    gap: isSmallScreen ? 12 : 32,
    flexWrap: 'wrap',
  },
  statItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  statNumber: {
    fontSize: isSmallScreen ? 28 : 36,
    fontWeight: '800',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.lightGray,
  },

  // Section Styles
  section: {
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  sectionAlt: {
    backgroundColor: COLORS.white,
  },
  sectionHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconBadge: {
    backgroundColor: 'rgba(37, 181, 115, 0.12)',
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: isSmallScreen ? 26 : 32,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 600,
  },

  // Curriculum Grid
  curriculumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  curriculumCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    width: isSmallScreen ? '100%' : 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  dayBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  dayBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  curriculumTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  curriculumDesc: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
  },

  // Features Grid
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    justifyContent: 'center',
  },
  featureCard: {
    backgroundColor: COLORS.background,
    borderRadius: 20,
    padding: 24,
    width: isSmallScreen ? '100%' : 280,
    alignItems: 'center',
  },
  featureIconWrap: {
    backgroundColor: 'rgba(37, 181, 115, 0.12)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  featureDesc: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Benefits Section
  benefitsSection: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    justifyContent: 'center',
  },
  benefitCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 24,
    width: isSmallScreen ? '100%' : 260,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  benefitIcon: {
    backgroundColor: COLORS.accent,
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  benefitTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 8,
    textAlign: 'center',
  },
  benefitDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 21,
  },

  // Advisors Section
  advisorsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  advisorsContent: {
    alignItems: 'center',
  },
  advisorsIconRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  advisorIcon: {
    backgroundColor: 'rgba(37, 181, 115, 0.12)',
    padding: 16,
    borderRadius: 16,
  },
  advisorsTitle: {
    fontSize: isSmallScreen ? 22 : 26,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  advisorsDesc: {
    fontSize: 15,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 600,
    marginBottom: 24,
  },
  advisorsBenefits: {
    gap: 12,
    alignItems: 'flex-start',
  },
  advisorBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  advisorBenefitText: {
    fontSize: 15,
    color: COLORS.darkGray,
    fontWeight: '500',
  },

  // CTA Section
  ctaSection: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    backgroundColor: COLORS.background,
  },
  ctaCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  ctaTitle: {
    fontSize: isSmallScreen ? 22 : 28,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  ctaDesc: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 500,
    marginBottom: 28,
  },
  ctaButton: {
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 14,
    gap: 12,
    shadowColor: COLORS.accentDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },

  // Employee Section
  employeeSection: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 24,
    paddingVertical: 50,
    alignItems: 'center',
  },
  employeeTitle: {
    fontSize: isSmallScreen ? 22 : 26,
    fontWeight: '700',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 12,
  },
  employeeDesc: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 500,
    marginBottom: 28,
  },
  employeeButtons: {
    flexDirection: isSmallScreen ? 'column' : 'row',
    gap: 16,
    alignItems: 'center',
  },
  employeeButton: {
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  employeeButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  loginButton: {
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  loginButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },

  // Footer
  footer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  footerLogo: {
    width: 140,
    height: 40,
    marginBottom: 12,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 8,
  },
  copyright: {
    fontSize: 13,
    color: COLORS.lightGray,
  },
});
