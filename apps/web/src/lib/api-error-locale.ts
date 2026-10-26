import type { Locale } from "./locale";

const messages: Record<string, Record<Locale, string>> = {
  GROUP_CHANGED: { en: "This group changed. Close this dialog and refresh before saving.", fr: "Ce groupe a changé. Fermez cette fenêtre et actualisez avant d’enregistrer.", ar: "تغيّرت هذه المجموعة. أغلق النافذة وحدّث الصفحة قبل الحفظ." },
  GROUP_SETUP_INCOMPLETE: { en: "Set each group goal and assign active reviewers before activation.", fr: "Définissez chaque objectif et attribuez les évaluateurs actifs avant activation.", ar: "حدّد أهداف المجموعات وعيّن المقيّمين النشطين قبل التفعيل." },
  GROUP_FORM_REQUIRED: { en: "Choose an assigned group form to create a new link.", fr: "Choisissez un formulaire attribué au groupe pour créer un lien.", ar: "اختر نموذجًا معيّنًا للمجموعة لإنشاء رابط جديد." },
  GROUP_NAME_EXISTS: { en: 'A group with this name already exists.', fr: 'Un groupe porte déjà ce nom.', ar: 'توجد مجموعة بهذا الاسم بالفعل.' },
  GROUP_NOT_FOUND: { en: 'Reviewer group not found. Refresh and try again.', fr: 'Groupe introuvable. Actualisez et réessayez.', ar: 'لم يتم العثور على المجموعة. حدّث الصفحة وحاول مرة أخرى.' },
  FORM_ASSIGNMENT_INVALID: { en: 'Select published forms from this workspace only.', fr: 'Sélectionnez uniquement les formulaires publiés dans cet espace.', ar: 'اختر نماذج منشورة في مساحة العمل هذه فقط.' },
  REVIEWER_SETTINGS_ONLY: { en: 'These settings apply to reviewers only.', fr: 'Ces paramètres concernent uniquement les réviseurs.', ar: 'تطبق هذه الإعدادات على المراجعين فقط.' },
  INVALID_CURSOR: { en: 'Refresh the list and try again.', fr: 'Actualisez la liste et réessayez.', ar: 'حدّث القائمة وحاول مرة أخرى.' },
  ACCOUNT_UNAVAILABLE: { en: "This account is unavailable.", fr: "Ce compte n’est pas disponible.", ar: "هذا الحساب غير متاح." },
  ALREADY_MEMBER: { en: "This person is already a member of the workspace.", fr: "Cette personne est déjà membre de l’espace.", ar: "هذا الشخص عضو بالفعل في مساحة العمل." },
  ASSIGNMENT_CHANGED: { en: "The assignment changed. Refresh the page and try again.", fr: "L’affectation a changé. Actualisez la page et réessayez.", ar: "تغير التكليف. حدّث الصفحة وحاول مرة أخرى." },
  AUTH_RATE_LIMITED: { en: "Too many sign-in attempts. Try again later.", fr: "Trop de tentatives de connexion. Réessayez plus tard.", ar: "محاولات تسجيل دخول كثيرة. حاول مرة أخرى لاحقاً." },
  CSRF_REJECTED: { en: "Your session expired. Refresh the page and try again.", fr: "Votre session a expiré. Actualisez la page et réessayez.", ar: "انتهت صلاحية جلستك. حدّث الصفحة وحاول مرة أخرى." },
  FORBIDDEN: { en: "You do not have permission to do this.", fr: "Vous n’avez pas l’autorisation d’effectuer cette action.", ar: "ليست لديك صلاحية لتنفيذ هذا الإجراء." },
  FORM_HAS_SUBMISSIONS: { en: "Remove this form’s submissions before permanently deleting it.", fr: "Supprimez les réponses de ce formulaire avant de le supprimer définitivement.", ar: "احذف إجابات هذا النموذج قبل حذفه نهائياً." },
  FORM_NOT_FOUND: { en: "Form not found.", fr: "Formulaire introuvable.", ar: "لم يتم العثور على النموذج." },
  FORM_NOT_PUBLISHABLE: { en: "Add at least one valid question before publishing.", fr: "Ajoutez au moins une question valide avant de publier.", ar: "أضف سؤالاً صالحاً واحداً على الأقل قبل النشر." },
  FORM_NOT_PUBLISHED: { en: "This form has not been published.", fr: "Ce formulaire n’a pas été publié.", ar: "لم يتم نشر هذا النموذج." },
  FORM_VERSION_NOT_FOUND: { en: "The published form version could not be found.", fr: "Impossible de trouver cette version publiée du formulaire.", ar: "تعذر العثور على نسخة النموذج المنشورة." },
  IDEMPOTENCY_KEY_REUSED: { en: "This request was already used. Refresh and try again.", fr: "Cette demande a déjà été utilisée. Actualisez la page et réessayez.", ar: "تم استخدام هذا الطلب من قبل. حدّث الصفحة وحاول مرة أخرى." },
  INVALID_ANSWER: { en: "One or more answers are invalid. Review the form and try again.", fr: "Une ou plusieurs réponses sont invalides. Vérifiez le formulaire et réessayez.", ar: "إجابة واحدة أو أكثر غير صالحة. راجع النموذج وحاول مرة أخرى." },
  INVALID_ANSWERS: { en: "One or more answers are invalid. Review the form and try again.", fr: "Une ou plusieurs réponses sont invalides. Vérifiez le formulaire et réessayez.", ar: "إجابة واحدة أو أكثر غير صالحة. راجع النموذج وحاول مرة أخرى." },
  INVALID_CREDENTIALS: { en: "Email, password, or workspace is incorrect.", fr: "L’adresse e-mail, le mot de passe ou l’espace de travail est incorrect.", ar: "البريد الإلكتروني أو كلمة المرور أو مساحة العمل غير صحيحة." },
  INVITATION_CHANGED: { en: "This invitation has changed. Ask your administrator for a new one.", fr: "Cette invitation a changé. Demandez-en une nouvelle à votre administrateur.", ar: "تغيرت هذه الدعوة. اطلب دعوة جديدة من المسؤول." },
  INVITATION_INVALID: { en: "This invitation is invalid or has expired.", fr: "Cette invitation est invalide ou a expiré.", ar: "هذه الدعوة غير صالحة أو انتهت صلاحيتها." },
  INVITATION_NOT_FOUND: { en: "Invitation not found.", fr: "Invitation introuvable.", ar: "لم يتم العثور على الدعوة." },
  INVITATION_TOKEN_UNAVAILABLE: { en: "This invitation token is no longer available.", fr: "Ce jeton d’invitation n’est plus disponible.", ar: "رمز الدعوة هذا لم يعد متاحاً." },
  LINK_NOT_FOUND: { en: "Review link not found.", fr: "Lien de révision introuvable.", ar: "لم يتم العثور على رابط المراجعة." },
  LINK_TOKEN_UNAVAILABLE: { en: "This review link is no longer available.", fr: "Ce lien de révision n’est plus disponible.", ar: "رابط المراجعة هذا لم يعد متاحاً." },
  MEMBER_HAS_SUBMISSIONS: { en: "This member has submissions and cannot be removed yet.", fr: "Ce membre a des réponses et ne peut pas encore être supprimé.", ar: "لدى هذا العضو إجابات ولا يمكن إزالته الآن." },
  MEMBER_MUST_BE_REMOVED: { en: "Remove this member before continuing.", fr: "Supprimez ce membre avant de continuer.", ar: "أزل هذا العضو قبل المتابعة." },
  MEMBER_NOT_FOUND: { en: "Team member not found.", fr: "Membre de l’équipe introuvable.", ar: "لم يتم العثور على عضو الفريق." },
  ORIGIN_REJECTED: { en: "This request could not be verified. Refresh the page and try again.", fr: "Impossible de vérifier cette demande. Actualisez la page et réessayez.", ar: "تعذر التحقق من هذا الطلب. حدّث الصفحة وحاول مرة أخرى." },
  OWNER_PROTECTED: { en: "The workspace owner cannot be removed.", fr: "Le propriétaire de l’espace ne peut pas être supprimé.", ar: "لا يمكن إزالة مالك مساحة العمل." },
  PASSWORD_RESET_INVALID: { en: "The reset token or password is invalid.", fr: "Le jeton ou le mot de passe est invalide.", ar: "رمز إعادة التعيين أو كلمة المرور غير صالح." },
  PASSWORD_RESET_NOT_FOUND: { en: "Password reset request not found or expired.", fr: "Demande de réinitialisation introuvable ou expirée.", ar: "طلب إعادة تعيين كلمة المرور غير موجود أو انتهت صلاحيته." },
  REQUIRED_ANSWER_MISSING: { en: "Complete all required questions before submitting.", fr: "Répondez à toutes les questions obligatoires avant l’envoi.", ar: "أكمل جميع الأسئلة المطلوبة قبل الإرسال." },
  REVIEWER_NOT_FOUND: { en: "Reviewer not found.", fr: "Réviseur introuvable.", ar: "لم يتم العثور على المراجع." },
  SUBMISSION_NOT_FOUND: { en: "Submission not found.", fr: "Réponse introuvable.", ar: "لم يتم العثور على الإجابة." },
  SUBMISSION_STATE_CONFLICT: { en: "This submission changed. Refresh and try again.", fr: "Cette réponse a changé. Actualisez la page et réessayez.", ar: "تغيرت هذه الإجابة. حدّث الصفحة وحاول مرة أخرى." },
  TARGET_NOT_FOUND: { en: "Review target not found.", fr: "Personne à évaluer introuvable.", ar: "لم يتم العثور على الشخص المطلوب مراجعته." },
  UNKNOWN_FIELD: { en: "The form contains an unknown question. Ask the administrator to update it.", fr: "Le formulaire contient une question inconnue. Demandez à l’administrateur de le mettre à jour.", ar: "يحتوي النموذج على سؤال غير معروف. اطلب من المسؤول تحديثه." },
  INVALID_RESPONSE: { en: "The service returned an unexpected response.", fr: "Le service a renvoyé une réponse inattendue.", ar: "أعادت الخدمة استجابة غير متوقعة." },
  NETWORK_ERROR: { en: "The service could not be reached. Check your connection and try again.", fr: "Le service est inaccessible. Vérifiez votre connexion et réessayez.", ar: "تعذر الوصول إلى الخدمة. تحقق من اتصالك وحاول مرة أخرى." },
  REQUEST_FAILED: { en: "The request could not be completed. Please try again.", fr: "La demande n’a pas pu aboutir. Veuillez réessayer.", ar: "تعذر إكمال الطلب. يرجى المحاولة مرة أخرى." },
};

const fallback: Record<Locale, string> = {
  en: "Something went wrong. Please try again.",
  fr: "Une erreur s’est produite. Veuillez réessayer.",
  ar: "حدث خطأ. يرجى المحاولة مرة أخرى.",
};

export function localizeApiError(code: string, locale: Locale): string {
  return messages[code]?.[locale] ?? fallback[locale];
}
