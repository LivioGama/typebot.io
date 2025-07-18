import { DownloadIcon, TemplateIcon, ToolIcon } from "@/components/icons";
import { CreateWithAIButton } from "@/features/ai";
import { useUser } from "@/features/user/hooks/useUser";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { trpc } from "@/lib/queryClient";
import { toast } from "@/lib/toast";
import {
  Button,
  Heading,
  Stack,
  VStack,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { useMutation } from "@tanstack/react-query";
import { useTranslate } from "@tolgee/react";
import type { Typebot } from "@typebot.io/typebot/schemas/typebot";
import { useRouter } from "next/router";
import { useState } from "react";
import { ImportTypebotFromFileButton } from "./ImportTypebotFromFileButton";
import { TemplatesModal } from "./TemplatesModal";

export const CreateNewTypebotButtons = () => {
  const { t } = useTranslate();
  const { workspace } = useWorkspace();
  const { user } = useUser();
  const router = useRouter();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [isLoading, setIsLoading] = useState(false);

  const { mutate: createTypebot } = useMutation(
    trpc.typebot.createTypebot.mutationOptions({
      onMutate: () => {
        setIsLoading(true);
      },
      onError: (error) => {
        toast({
          description: error.message,
        });
      },
      onSuccess: (data) => {
        router.push({
          pathname: `/typebots/${data.typebot.id}/edit`,
        });
      },
      onSettled: () => {
        setIsLoading(false);
      },
    }),
  );

  const { mutate: importTypebot } = useMutation(
    trpc.typebot.importTypebot.mutationOptions({
      onMutate: () => {
        setIsLoading(true);
      },
      onError: (error) => {
        toast({
          description: error.data?.zodError ?? error.message,
        });
      },
      onSuccess: (data) => {
        router.push({
          pathname: `/typebots/${data.typebot.id}/edit`,
        });
      },
      onSettled: () => {
        setIsLoading(false);
      },
    }),
  );

  const handleCreateSubmit = async (
    typebot?: Typebot,
    fromTemplate?: string,
  ) => {
    if (!user || !workspace) return;
    const folderId = router.query.folderId?.toString() ?? null;
    if (typebot)
      importTypebot({
        workspaceId: workspace.id,
        typebot: {
          ...typebot,
          folderId,
        },
        fromTemplate,
      });
    else
      createTypebot({
        workspaceId: workspace.id,
        typebot: {
          name: t("typebots.defaultName"),
          folderId,
        },
      });
  };

  return (
    <VStack w="full" pt="20" spacing={10}>
      <Stack
        w="full"
        maxW="650px"
        p="10"
        gap={10}
        rounded="lg"
        borderWidth={1}
        bgColor={useColorModeValue("white", "gray.900")}
      >
        <Heading>{t("templates.buttons.heading")}</Heading>
        <Stack w="full" spacing={6}>
          <Button
            variant="outline"
            w="full"
            py="8"
            fontSize="lg"
            leftIcon={
              <ToolIcon
                color={useColorModeValue("blue.500", "blue.300")}
                boxSize="25px"
                mr="2"
              />
            }
            onClick={() => handleCreateSubmit()}
            isLoading={isLoading}
          >
            {t("templates.buttons.fromScratchButton.label")}
          </Button>
          <Button
            variant="outline"
            w="full"
            py="8"
            fontSize="lg"
            leftIcon={
              <TemplateIcon
                color={useColorModeValue("orange.500", "orange.300")}
                boxSize="25px"
                mr="2"
              />
            }
            onClick={onOpen}
            isLoading={isLoading}
          >
            {t("templates.buttons.fromTemplateButton.label")}
          </Button>
          <ImportTypebotFromFileButton
            variant="outline"
            w="full"
            py="8"
            fontSize="lg"
            leftIcon={
              <DownloadIcon
                color={useColorModeValue("purple.500", "purple.300")}
                boxSize="25px"
                mr="2"
              />
            }
            isLoading={isLoading}
            onNewTypebot={handleCreateSubmit}
          >
            {t("templates.buttons.importFileButton.label")}
          </ImportTypebotFromFileButton>
          <CreateWithAIButton />
        </Stack>
      </Stack>

      <TemplatesModal
        isOpen={isOpen}
        onClose={onClose}
        onTypebotChoose={handleCreateSubmit}
        isLoading={isLoading}
      />
    </VStack>
  );
};
